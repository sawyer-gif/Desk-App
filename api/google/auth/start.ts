import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { verifyToken } from "@clerk/backend";

export const runtime = "nodejs";

const SESSION_COOKIE_KEYS = ["__session", "__clerk_session"];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function readSessionToken(cookieHeader: string | undefined) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    for (const key of SESSION_COOKIE_KEYS) {
      if (part.startsWith(`${key}=`)) {
        return decodeURIComponent(part.slice(key.length + 1));
      }
    }
  }
  return null;
}

function signState(payload: string) {
  const secret = requireEnv("OAUTH_STATE_SECRET");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    const sessionToken = readSessionToken(req.headers.cookie);
    if (!sessionToken) {
      res.status(401).send("Missing session token");
      return;
    }

    const verified = await verifyToken(sessionToken, {
      secretKey: requireEnv("CLERK_SECRET_KEY"),
    });

    const userId = verified?.sub;
    if (!userId) {
      res.status(401).send("Invalid session token");
      return;
    }

    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");

    const rawState = `${userId}:${Date.now()}`;
    const state = signState(rawState);

    const scope = encodeURIComponent(
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" ")
    );

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&include_granted_scopes=false` +
      `&state=${encodeURIComponent(state)}`;

    res.status(302).setHeader("Location", url).end();
  } catch (err: any) {
    console.error("[Desk][oauth-start]", err);
    res.status(500).send(err?.message || "OAuth start error");
  }
}
