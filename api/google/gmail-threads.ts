import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await r.json();
  if (!r.ok) throw new Error(json?.error_description || "Refresh failed");
  return json as { access_token: string; expires_in?: number; token_type?: string };
}

async function gmailListThreads(accessToken: string, maxResults = 15) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await r.json();
  if (!r.ok) throw new Error("Failed to list threads");
  return json as { threads?: { id: string }[] };
}

async function gmailGetThreadMeta(accessToken: string, threadId: string) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
    `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await r.json();
  if (!r.ok) throw new Error("Failed to fetch thread");
  return json as any;
}

function headerValue(headers: any[], name: string) {
  const h = headers?.find((x: any) => (x?.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const verified = await verifyToken(token, {
      secretKey: requireEnv("CLERK_SECRET_KEY"),
    });

    const userId = verified.sub;
    if (!userId) return res.status(401).json({ error: "No userId in token" });

    const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
    const user = await clerk.users.getUser(userId);

    const google = (user.privateMetadata as any)?.google?.gmail;
    const refreshToken = google?.refresh_token;

    if (!google?.connected) {
      return res.status(200).json({ connected: false, threads: [] });
    }
    if (!refreshToken) {
      return res.status(200).json({
        connected: true,
        needsReconnect: true,
        threads: [],
        message: "No refresh token stored. Reconnect Gmail to issue one.",
      });
    }

    const { access_token } = await refreshAccessToken(refreshToken);

    const list = await gmailListThreads(access_token, Number(req.query.max || 15));
    const ids = (list.threads || []).map((t) => t.id);

    const metas = [];
    for (const id of ids) {
      const thread = await gmailGetThreadMeta(access_token, id);
      const msg0 = thread?.messages?.[0];
      const headers = msg0?.payload?.headers || [];
      metas.push({
        id,
        subject: headerValue(headers, "Subject"),
        from: headerValue(headers, "From"),
        date: headerValue(headers, "Date"),
        snippet: msg0?.snippet || "",
        messageCount: thread?.messages?.length || 0,
      });
    }

    return res.status(200).json({
      connected: true,
      email: google?.email || null,
      threads: metas,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
