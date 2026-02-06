import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";

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

    const payload = verifyState(state); // "userId:timestamp"
    const userId = payload.split(":")[0];
    if (!userId) return res.status(400).send("Invalid state payload");

    const tokens = await exchangeCodeForTokens(code);

    // Refresh token only arrives the FIRST time (or when prompt=consent)
    if (!tokens.refresh_token) {
      // Still save that "connected" happened, but warn.
      // Usually means user previously connected and Google isn't re-issuing refresh token.
    }

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

    // Redirect user back to your app
    return res.redirect(302, "https://desk-app-ivory.vercel.app/");
  } catch (e: any) {
    return res.status(500).send(e?.message || "OAuth callback error");
  }
}
