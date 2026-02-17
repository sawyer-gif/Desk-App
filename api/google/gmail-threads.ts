import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";

type GmailThreadListResponse = {
  threads?: { id: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type ThreadMeta = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  messageCount: number;
};

const MAX_THREAD_CAP = Number(process.env.GMAIL_THREAD_CAP || 250);
const PAGE_SIZE = Number(process.env.GMAIL_PAGE_SIZE || 100);
const THREAD_META_CONCURRENCY = Number(process.env.GMAIL_THREAD_CONCURRENCY || 8);

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

async function gmailListThreads(
  accessToken: string,
  opts: { maxResults: number; pageToken?: string; query?: string; labelIds?: string[] }
) {
  const params = new URLSearchParams({
    maxResults: String(opts.maxResults),
    includeSpamTrash: "false",
  });

  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  if (opts.query) params.set("q", opts.query);
  (opts.labelIds || []).forEach((label) => params.append("labelIds", label));

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await r.json();
  if (!r.ok) {
    const message = json?.error?.message || "Failed to list threads";
    throw new Error(message);
  }
  return json as GmailThreadListResponse;
}

async function gmailGetThreadMeta(accessToken: string, threadId: string) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
    `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await r.json();
  if (!r.ok) {
    const message = json?.error?.message || "Failed to fetch thread";
    throw new Error(message);
  }
  return json as any;
}

function headerValue(headers: any[], name: string) {
  const h = headers?.find((x: any) => (x?.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

async function fetchThreadMetas(accessToken: string, ids: string[]): Promise<ThreadMeta[]> {
  const metas: ThreadMeta[] = [];

  for (let i = 0; i < ids.length; i += THREAD_META_CONCURRENCY) {
    const chunk = ids.slice(i, i + THREAD_META_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((id) => gmailGetThreadMeta(accessToken, id)));

    results.forEach((result, index) => {
      if (result.status !== "fulfilled") {
        console.warn("[Desk] Failed to fetch thread", chunk[index], result.reason);
        return;
      }

      const thread = result.value;
      const msg0 = thread?.messages?.[0];
      const headers = msg0?.payload?.headers || [];

      metas.push({
        id: chunk[index],
        subject: headerValue(headers, "Subject"),
        from: headerValue(headers, "From"),
        date: headerValue(headers, "Date"),
        snippet: msg0?.snippet || "",
        messageCount: thread?.messages?.length || 0,
      });
    });
  }

  return metas;
}

function clampRangeDays(raw: any) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(60, Math.max(1, parsed));
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

    const rangeDays = clampRangeDays(req.query.days);
    const pageSize = Math.min(Number(req.query.pageSize) || PAGE_SIZE, 200);

    const queryParts = [`newer_than:${rangeDays}d`, "category:primary", "-in:chats"];
    const query = queryParts.join(" ");

    const ids: string[] = [];
    const seen = new Set<string>();
    let nextPageToken: string | undefined;
    let pageCount = 0;
    let estimate: number | undefined;

    do {
      const list = await gmailListThreads(access_token, {
        maxResults: pageSize,
        pageToken: nextPageToken,
        query,
        labelIds: ["INBOX"],
      });

      if (typeof list.resultSizeEstimate === "number" && estimate === undefined) {
        estimate = list.resultSizeEstimate;
      }

      const batch = list.threads || [];
      batch.forEach((thread) => {
        if (!thread?.id || seen.has(thread.id) || ids.length >= MAX_THREAD_CAP) return;
        seen.add(thread.id);
        ids.push(thread.id);
      });

      nextPageToken = list.nextPageToken && ids.length < MAX_THREAD_CAP ? list.nextPageToken : undefined;
      pageCount += 1;
    } while (nextPageToken);

    const metas = await fetchThreadMetas(access_token, ids);

    return res.status(200).json({
      connected: true,
      email: google?.email || null,
      threads: metas,
      meta: {
        totalFetched: metas.length,
        pages: pageCount,
        rangeDays,
        pageSize,
        estimate,
        capped: ids.length >= MAX_THREAD_CAP,
        primaryOnly: true,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
