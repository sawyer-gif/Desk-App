import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";

export const runtime = "nodejs";

const STATE_COOKIE_NAME = "desk_oauth_state";
const REFRESH_COOKIE_NAME = "desk_google_refresh";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function verifyState(state: string) {
  const secret = requireEnv("OAUTH_STATE_SECRET");
  const parts = state.split(".");
  if (parts.length < 2) throw new Error("Invalid state format");
  const sig = parts.pop()!;
  const payload = parts.join(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (sig !== expected) throw new Error("Invalid state signature");
  return payload; // userId:timestamp
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const parts = header.split(";");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await r.json();
  if (!r.ok) throw new Error(json?.error_description || "Token exchange failed");
  return json as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    token_type?: string;
  };
}

async function fetchGmailProfile(accessToken: string) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await r.json();
  if (!r.ok) throw new Error("Failed to fetch Gmail profile");
  return json as { emailAddress?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");

    if (!code || !state) return res.status(400).send("Missing code/state");

    const stateCookie = readCookie(req.headers.cookie, STATE_COOKIE_NAME);
    if (!stateCookie || stateCookie !== state) return res.status(400).send("Invalid OAuth state");

    const payload = verifyState(state);
    const userId = payload.split(":")[0];
    if (!userId) return res.status(400).send("Invalid state payload");

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGmailProfile(tokens.access_token);

    const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });

    await clerk.users.updateUser(userId, {
      privateMetadata: {
        google: {
          gmail: {
            connected: true,
            email: profile.emailAddress || null,
            refresh_token: tokens.refresh_token || null,
            scope: tokens.scope || null,
            connectedAt: new Date().toISOString(),
          },
        },
      },
    });

    const cookies = [
      `${STATE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    ];

    if (tokens.refresh_token) {
      cookies.push(
        `${REFRESH_COOKIE_NAME}=${encodeURIComponent(tokens.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
      );
    }

    res.setHeader("Set-Cookie", cookies);

    return res.redirect(302, "/?connected=1");
  } catch (e: any) {
    console.error("[Desk][oauth-callback]", e);
    return res.status(500).send(e?.message || "OAuth callback error");
  }
}
