import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClerkClient, verifyToken } from "@clerk/backend";

export const runtime = "nodejs";

const STATE_COOKIE_NAME = "desk_oauth_state";
const REFRESH_COOKIE_NAME = "desk_google_refresh";
const SESSION_COOKIE_KEYS = ["__session", "__clerk_session"];

type JsonPayload = { error: string } | { ok: true };

function sendJson(res: VercelResponse, status: number, payload: JsonPayload) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(payload));
}

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
  return payload;
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

function readSessionToken(header: string | undefined) {
  if (!header) return null;
  const parts = header.split(";");
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

async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || "https://desk-app-ivory.vercel.app/api/google/callback",
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

    if (!code || !state) {
      sendJson(res, 400, { error: "Missing code/state" });
      return;
    }

    const stateCookie = readCookie(req.headers.cookie, STATE_COOKIE_NAME);
    if (!stateCookie || stateCookie !== state) {
      sendJson(res, 400, { error: "Invalid OAuth state" });
      return;
    }

    const payload = verifyState(state);
    const stateUserId = payload.split(":")[0];
    if (!stateUserId) {
      sendJson(res, 400, { error: "Invalid state payload" });
      return;
    }

    const sessionToken = readSessionToken(req.headers.cookie);
    if (!sessionToken) {
      sendJson(res, 401, { error: "Missing session token" });
      return;
    }

    const verified = await verifyToken(sessionToken, {
      secretKey: requireEnv("CLERK_SECRET_KEY"),
    });

    const userId = verified?.sub;
    if (!userId || userId !== stateUserId) {
      sendJson(res, 401, { error: "Session mismatch" });
      return;
    }

    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGmailProfile(tokens.access_token);

    const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
    const user = await clerk.users.getUser(userId);
    const existingGoogle = ((user.privateMetadata as any)?.google?.gmail || {}) as Record<string, any>;
    const nextRefreshToken = tokens.refresh_token || existingGoogle.refresh_token || null;

    if (!nextRefreshToken) {
      sendJson(res, 400, { error: "Missing refresh token" });
      return;
    }

    const nextGoogleMetadata = {
      ...existingGoogle,
      connected: true,
      email: profile.emailAddress || existingGoogle.email || null,
      refresh_token: nextRefreshToken,
      scope: tokens.scope || existingGoogle.scope || null,
      connectedAt: new Date().toISOString(),
    };

    await clerk.users.updateUser(userId, {
      privateMetadata: {
        ...(user.privateMetadata || {}),
        google: {
          ...(typeof (user.privateMetadata as any)?.google === "object" ? (user.privateMetadata as any).google : {}),
          gmail: nextGoogleMetadata,
        },
      },
    });

    const cookies = [
      `${STATE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
    ];

    cookies.push(
      `${REFRESH_COOKIE_NAME}=${encodeURIComponent(nextRefreshToken)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
    );

    res.setHeader("Set-Cookie", cookies);
    res.redirect(302, "/");
  } catch (e: any) {
    console.error("[Desk][oauth-callback]", e);
    sendJson(res, 500, { error: e?.message || "OAuth callback error" });
  }
}
