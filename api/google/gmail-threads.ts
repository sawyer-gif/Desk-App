import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient, verifyToken } from "@clerk/backend";
import {
  ACTIONABILITY_NO_REPLY_PATTERNS,
  ACTIONABILITY_KEYWORD_BLOCKLIST,
} from "../../config/actionability";

export const config = {
  runtime: "nodejs18.x",
};

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
  meta?: {
    labelIds: string[];
    latestExternalFrom?: string;
    latestExternalEmail?: string;
    latestHeaders?: Record<string, string>;
    autoFlags?: string[];
  };
};

const MAX_THREAD_CAP = Number(process.env.GMAIL_THREAD_CAP || 250);
const PAGE_SIZE = Number(process.env.GMAIL_PAGE_SIZE || 100);
const THREAD_META_CONCURRENCY = Number(process.env.GMAIL_THREAD_CONCURRENCY || 8);

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
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

function parseEmailAddress(raw: string) {
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

function headersToMap(headers: any[]): Record<string, string> {
  return (headers || []).reduce((acc: Record<string, string>, header: any) => {
    if (!header?.name) return acc;
    acc[String(header.name).toLowerCase()] = String(header.value || "");
    return acc;
  }, {});
}

function findLatestExternalMessage(thread: any, accountEmail: string) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const headers = msg?.payload?.headers || [];
    const from = headerValue(headers, "From");
    const email = parseEmailAddress(from);
    if (!email) continue;
    if (accountEmail && email === accountEmail.toLowerCase()) continue;
    return { message: msg, headers, from, email };
  }
  return null;
}

function autoFlagReasons({
  headers,
  latestEmail,
  subject,
  snippet,
}: {
  headers: Record<string, string>;
  latestEmail: string;
  subject: string;
  snippet: string;
}) {
  const reasons: string[] = [];
  const precedence = headers["precedence"]?.toLowerCase() || "";
  if (precedence && /bulk|list|junk/.test(precedence)) {
    reasons.push(`precedence:${precedence}`);
  }

  const autoSubmitted = headers["auto-submitted"]?.toLowerCase() || "";
  if (autoSubmitted && autoSubmitted !== "no") {
    reasons.push(`auto-submitted:${autoSubmitted}`);
  }

  if (headers["list-id"]) {
    reasons.push("list-id");
  }

  if (latestEmail && ACTIONABILITY_NO_REPLY_PATTERNS.some((pattern) => latestEmail.includes(pattern))) {
    reasons.push("no-reply-sender");
  }

  const haystack = `${subject} ${snippet}`.toLowerCase();
  if (ACTIONABILITY_KEYWORD_BLOCKLIST.some((kw) => haystack.includes(kw))) {
    reasons.push("keyword-match");
  }

  return reasons;
}

async function fetchThreadMetas(accessToken: string, ids: string[], accountEmail: string): Promise<ThreadMeta[]> {
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
      const messages = Array.isArray(thread?.messages) ? thread.messages : [];
      const firstMessage = messages[0];
      const headers = firstMessage?.payload?.headers || [];
      const latestExternal = findLatestExternalMessage(thread, accountEmail);
      const latestHeadersMap = headersToMap(latestExternal?.headers || headers);
      const latestEmail = latestExternal?.email || parseEmailAddress(headerValue(headers, "From"));
      const subject = headerValue(headers, "Subject");
      const snippet = latestExternal?.message?.snippet || firstMessage?.snippet || "";
      const autoFlags = autoFlagReasons({
        headers: latestHeadersMap,
        latestEmail: latestEmail || "",
        subject: subject || "",
        snippet: snippet || "",
      });

      const labelIds = Array.from(
        new Set(
          messages.flatMap((msg: any) => (Array.isArray(msg?.labelIds) ? msg.labelIds : []))
        )
      );

      const lastMessage = messages[messages.length - 1];
      const lastHeaders = lastMessage?.payload?.headers || [];
      const lastFrom = parseEmailAddress(headerValue(lastHeaders, "From"));
      const lastMessageFromAccount = Boolean(accountEmail && lastFrom && lastFrom === accountEmail.toLowerCase());
      const hasInboxLabel = labelIds.includes("INBOX");

      metas.push({
        id: chunk[index],
        subject,
        from: headerValue(headers, "From"),
        date: headerValue(headers, "Date"),
        snippet,
        messageCount: messages.length,
        meta: {
          labelIds,
          latestExternalFrom: latestExternal?.from,
          latestExternalEmail: latestEmail,
          latestHeaders: latestHeadersMap,
          autoFlags,
          hasInbox: hasInboxLabel,
          lastMessageFromAccount,
          lastMessageEmail: lastFrom,
        },
      });
    });
  }

  return metas;
}

function clampRangeDays(raw: any) {
  const parsed = Number(raw);
  const fallback = 14;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(60, Math.max(1, parsed));
}

const REQUIRED_ENV_VARS = [
  "CLERK_SECRET_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "OAUTH_STATE_SECRET",
  "GOOGLE_REDIRECT_URI",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = `gmail-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const envDebug = {
    runtime: process.env.VERCEL ? "vercel" : "node",
    hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasOAuthStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
    hasRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
  };
  const respond = (status: number, body: Record<string, any>) =>
    res.status(status).json({ requestId, ...body, debug: envDebug });
  const log = (message: string, extra?: Record<string, any>) =>
    console.log(`[Desk][gmail-threads][${requestId}] ${message}`, extra || {});

  try {
    if (req.method !== "GET") {
      return respond(405, {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET supported.",
      });
    }

    const authHeaderRaw = req.headers && typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : (req.headers && typeof (req.headers as any).Authorization === "string"
        ? (req.headers as any).Authorization
        : "");
    const token = authHeaderRaw.startsWith("Bearer ") ? authHeaderRaw.slice(7) : "";
    const hasAuthHeader = Boolean(token);
    const daysParam = req.query.days;
    log("request:start", { hasAuthHeader, daysParam });

    if (!token) {
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in to sync.",
      });
    }

    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret) {
      log("missing-env", { missing: ["CLERK_SECRET_KEY"] });
      return respond(500, {
        ok: false,
        code: "MISSING_ENV",
        message: "Missing server env vars",
      });
    }

    let verified;
    try {
      verified = await verifyToken(token, { secretKey: clerkSecret });
    } catch (authErr) {
      log("clerk-verify-failed", { message: authErr?.message });
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in to sync.",
      });
    }

    const userId = verified?.sub;
    if (!userId) {
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in to sync.",
      });
    }

    const remainingMissing = REQUIRED_ENV_VARS.filter((key) => key !== "CLERK_SECRET_KEY" && !process.env[key]);
    if (remainingMissing.length) {
      log("missing-env", { missing: remainingMissing });
      return respond(500, {
        ok: false,
        code: "MISSING_ENV",
        message: "Missing server env vars",
      });
    }

    const clerk = createClerkClient({ secretKey: clerkSecret });
    const user = await clerk.users.getUser(userId);

    const google = (user.privateMetadata as any)?.google?.gmail;
    const refreshToken = google?.refresh_token;

    if (!google?.connected) {
      return respond(403, {
        ok: false,
        code: "GOOGLE_NOT_CONNECTED",
        message: "Connect Google to sync.",
      });
    }
    if (!refreshToken) {
      return respond(403, {
        ok: false,
        code: "GOOGLE_NOT_CONNECTED",
        message: "Connect Google to sync.",
      });
    }

    let accessToken: string;
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
    } catch (err: any) {
      log("refresh-failed", { message: err?.message });
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Connect Google to sync.",
      });
    }

    const rangeDays = clampRangeDays(req.query.days);
    const requestedPageSize = Number(req.query.pageSize);
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(Math.max(1, requestedPageSize), 200)
      : PAGE_SIZE;
    const accountEmail = (google?.email || "").toLowerCase();

    const queryParts = [
      `newer_than:${rangeDays}d`,
      "category:primary",
      "-category:promotions",
      "-category:social",
      "-category:updates",
      "-in:spam",
      "-in:trash",
      "-in:chats",
    ];
    const query = queryParts.join(" ");

    const ids: string[] = [];
    const seen = new Set<string>();
    let nextPageToken: string | undefined;
    let pageCount = 0;
    let estimate: number | undefined;

    try {
      do {
        const list = await gmailListThreads(accessToken, {
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
    } catch (err: any) {
      log("gmail-list-failed", { message: err?.message });
      const msg = (err?.message || "Google sync failed").toLowerCase();
      if (msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("401")) {
        return respond(401, {
          ok: false,
          code: "AUTH_REQUIRED",
          message: "Connect Google to sync.",
        });
      }
      return respond(500, {
        ok: false,
        code: "SYNC_FAILED",
        message: "Sync failed",
        detail: err?.message || "Unable to list threads",
      });
    }

    let metas: ThreadMeta[] = [];
    try {
      metas = await fetchThreadMetas(accessToken, ids, accountEmail);
    } catch (err: any) {
      log("thread-meta-failed", { message: err?.message });
      return respond(500, {
        ok: false,
        code: "SYNC_FAILED",
        message: "Sync failed",
        detail: err?.message || "Unable to load thread metadata",
      });
    }

    return res.status(200).json({
      ok: true,
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
      requestId,
    });
  } catch (e: any) {
    const errorName = e?.name || "Error";
    const errorMessage = typeof e?.message === "string" ? e.message : "Unknown error";
    log("sync-failed", {
      errorName,
      errorMessage,
      stack: typeof e?.stack === "string" ? e.stack.split("\n")[0]?.trim() : undefined,
    });
    console.error("[gmail-threads]", { requestId, code: "SYNC_FAILED", errorName });
    return respond(500, {
      ok: false,
      code: "SYNC_FAILED",
      message: "Sync failed",
      errorName,
      errorMessage,
    });
  }
}
