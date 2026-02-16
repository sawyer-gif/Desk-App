import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Buffer } from "buffer";

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
  return json as { access_token: string };
}

function headerValue(headers: any[], name: string) {
  const h = headers?.find((x: any) => (x?.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function decodeBody(data?: string | null) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractBodies(payload: any) {
  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  const stack = [payload, ...parts];
  const result = { html: "", text: "", attachments: [] as any[] };

  while (stack.length) {
    const part = stack.pop();
    if (!part) continue;

    if (Array.isArray(part.parts)) {
      stack.push(...part.parts);
    }

    const mime = (part.mimeType || "").toLowerCase();
    const bodyData = part.body?.data;

    if (bodyData) {
      if (mime === "text/html") {
        result.html += decodeBody(bodyData);
      } else if (mime === "text/plain") {
        result.text += decodeBody(bodyData);
      }
    }

    if (part.body?.attachmentId) {
      result.attachments.push({
        filename: part.filename || "attachment",
        mimeType: part.mimeType,
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
        inline: part.headers?.some((h: any) => h.name?.toLowerCase() === "content-id"),
      });
    }
  }

  return result;
}

function parseAddress(raw: string) {
  if (!raw) return { name: "", email: "" };
  const match = raw.match(/<([^>]+)>/);
  const email = match?.[1] || raw;
  const name = raw.split("<")[0]?.trim() || email;
  return { name, email };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const threadId = (req.query.threadId as string) || "";
    if (!threadId) {
      return res.status(400).json({ error: "Missing threadId" });
    }

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
      return res.status(200).json({ connected: false, threadId, messages: [] });
    }
    if (!refreshToken) {
      return res.status(200).json({
        connected: true,
        needsReconnect: true,
        threadId,
        messages: [],
        message: "No refresh token stored. Reconnect Gmail to issue one.",
      });
    }

    const { access_token } = await refreshAccessToken(refreshToken);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
    const threadResp = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    const threadJson = await threadResp.json();
    if (!threadResp.ok) {
      throw new Error(threadJson?.error?.message || "Failed to fetch thread detail");
    }

    const messages = (threadJson?.messages ?? []).map((message: any) => {
      const headers = message?.payload?.headers || [];
      const subject = headerValue(headers, "Subject");
      const from = headerValue(headers, "From");
      const to = headerValue(headers, "To");
      const cc = headerValue(headers, "Cc");
      const { name, email } = parseAddress(from);
      const body = extractBodies(message?.payload);
      const timestamp = message?.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();

      return {
        id: message.id,
        threadId,
        subject,
        sender: name || email || 'Unknown sender',
        senderEmail: email,
        to,
        cc,
        snippet: message.snippet || '',
        timestamp,
        textBody: body.text || '',
        htmlBody: body.html || '',
        attachments: body.attachments,
      };
    });

    return res.status(200).json({ connected: true, threadId, messages });
  } catch (e: any) {
    console.error('[gmail-thread-detail]', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
