
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

export const runtime = "nodejs";

const STATE_COOKIE_NAME = "desk_oauth_state";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
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

    const statePayload = crypto.randomBytes(16).toString("hex");
    const signedState = signState(statePayload);

    res.setHeader(
      "Set-Cookie",
      `${STATE_COOKIE_NAME}=${signedState}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`
    );

    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");

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
      `&state=${encodeURIComponent(signedState)}`;

    res.status(302).setHeader("Location", url).end();
  } catch (err: any) {
    console.error("[Desk][oauth-start]", err);
    res.status(500).send(err?.message || "OAuth start error");
  }
}
