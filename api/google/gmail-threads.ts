import type { VercelRequest, VercelResponse } from "@vercel/node";

import { createClerkClient, verifyToken } from "@clerk/backend";

export const runtime = "nodejs";

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
    hasInbox?: boolean;
    lastMessageFromAccount?: boolean;
    lastMessageEmail?: string;
  };
};

const MAX_THREAD_CAP = Number(process.env.GMAIL_THREAD_CAP || 250);
const PAGE_SIZE = Number(process.env.GMAIL_PAGE_SIZE || 100);
const THREAD_META_CONCURRENCY = Number(process.env.GMAIL_THREAD_CONCURRENCY || 8);

class GmailApiError extends Error {
  status: number;
  reason?: string;
  details?: Record<string, any>;

  constructor(message: string, opts: { status?: number; reason?: string; details?: Record<string, any> }) {
    super(message);
    this.name = "GmailApiError";
    this.status = opts.status ?? 502;
    this.reason = opts.reason;
    this.details = opts.details;
  }
}

function extractRetryAfter(headers: Headers | undefined) {
  if (!headers) return undefined;
  const value = headers.get("retry-after") || headers.get("Retry-After");
  return value || undefined;
}

type NormalizedGoogleError = {
  status: number;
  code: "AUTH_REQUIRED" | "GOOGLE_NOT_CONNECTED" | "GMAIL_RATE_LIMIT" | "GMAIL_UPSTREAM_ERROR";
  message: string;
  reason?: string;
  retryAfter?: string;
  upstreamStatus?: number;
};

function normalizeGoogleError(error: unknown): NormalizedGoogleError | null {
  if (!(error instanceof GmailApiError)) return null;
  const bodyError = typeof error.details?.body?.error === "string" ? error.details.body.error : undefined;
  const bodyReason =
    error.details?.body?.error?.status ||
    error.details?.body?.error?.errors?.[0]?.reason ||
    error.details?.body?.error_description;
  const mergedReason = error.reason || bodyReason || bodyError;
  const normalizedReason = mergedReason ? String(mergedReason) : undefined;
  const lowerReason = normalizedReason?.toLowerCase();
  const isAuthError =
    lowerReason === "invalid_grant" ||
    lowerReason === "invalid_client" ||
    lowerReason === "unauthorized_client" ||
    lowerReason === "token_revoked";
  const isRateLimit =
    lowerReason === "rate_limit_exceeded" ||
    lowerReason === "user_rate_limit_exceeded" ||
    lowerReason === "daily_limit_exceeded" ||
    lowerReason === "quotaexceeded" ||
    error.status === 429;
  const upstreamStatus = error.status || 502;
  const normalizedStatus = isAuthError ? 401 : isRateLimit ? 429 : upstreamStatus;
  const code =
    normalizedStatus === 401
      ? "AUTH_REQUIRED"
      : normalizedStatus === 403
      ? "GOOGLE_NOT_CONNECTED"
      : normalizedStatus === 429
      ? "GMAIL_RATE_LIMIT"
      : "GMAIL_UPSTREAM_ERROR";
  const message =
    normalizedStatus === 401
      ? "Reconnect Google to sync."
      : normalizedStatus === 403
      ? "Google access is blocked."
      : normalizedStatus === 429
      ? "Gmail rate limit hit. Try again later."
      : "Gmail request failed.";
  return {
    status: normalizedStatus,
    code,
    message,
    reason: normalizedReason,
    retryAfter: error.details?.retryAfter,
    upstreamStatus: error.status,
  };
}

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

  let json: any = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }

  if (!r.ok) {
    throw new GmailApiError(json?.error_description || "Refresh failed", {
      status: r.status,
      reason: json?.error,
      details: { body: json, retryAfter: extractRetryAfter(r.headers) },
    });
  }

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
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  if (!r.ok) {
    const message = json?.error?.message || "Failed to list threads";
    throw new GmailApiError(message, {
      status: r.status,
      reason: json?.error?.status || json?.error?.errors?.[0]?.reason || json?.error,
      details: { body: json, retryAfter: extractRetryAfter(r.headers) },
    });
  }
  return json as GmailThreadListResponse;
}

async function gmailGetThreadMeta(accessToken: string, threadId: string) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
    `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  if (!r.ok) {
    const message = json?.error?.message || "Failed to fetch thread";
    throw new GmailApiError(message, {
      status: r.status,
      reason: json?.error?.status || json?.error?.errors?.[0]?.reason || json?.error,
      details: { body: json, retryAfter: extractRetryAfter(r.headers) },
    });
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
  const runtimeMode = process.env.VERCEL ? "vercel" : "node";
  const envFlags = {
    hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasOAuthStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
    hasRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
  };
  let signedIn = false;
  let googleConnected = false;
  let hasRefreshToken = false;
  let hasAccessToken = false;

  const respond = (
    status: number,
    body: Record<string, any>,
    options: { includeDebug?: boolean } = {}
  ) => {
    const payload: Record<string, any> = { requestId, ...body };
    if (options.includeDebug) {
      payload.debug = { runtime: runtimeMode, ...envFlags };
    }
    return res.status(status).json(payload);
  };

  const log = (message: string, extra?: Record<string, any>) =>
    console.log(`[Desk][gmail-threads][${requestId}] ${message}`, extra || {});

  try {
    log("request-start", { method: req.method, signedIn, googleConnected });
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

    if (!token) {
      log("auth-header-missing", { signedIn, googleConnected });
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in to sync.",
      });
    }

    const missingEnv = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (missingEnv.length) {
      log("missing-env", { missingEnv });
      return respond(500, {
        ok: false,
        code: "SERVER_MISCONFIG",
        message: "Missing server configuration.",
      }, { includeDebug: true });
    }

    const clerkSecret = process.env.CLERK_SECRET_KEY as string;

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
      log("auth-missing-user", { signedIn, googleConnected });
      return respond(401, {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in to sync.",
      });
    }

    signedIn = true;
    log("auth-ok", { signedIn, googleConnected });

    const clerk = createClerkClient({ secretKey: clerkSecret });
    const user = await clerk.users.getUser(userId);

    const google = (user.privateMetadata as any)?.google?.gmail;
    const refreshToken = google?.refresh_token;
    hasRefreshToken = Boolean(refreshToken);

    if (!google?.connected || !refreshToken) {
      log("google-not-connected", { signedIn, googleConnected });
      return respond(403, {
        ok: false,
        code: "GOOGLE_NOT_CONNECTED",
        message: "Connect Google to sync.",
      });
    }

    googleConnected = true;

    let accessToken: string;
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      hasAccessToken = true;
    } catch (err: unknown) {
      const normalized = normalizeGoogleError(err);
      if (normalized) {
        log("refresh-failed", { message: normalized.reason, status: normalized.status });
        return respond(normalized.status, {
          ok: false,
          code: normalized.code,
          message: normalized.message,
          details: {
            stage: "refresh-token",
            reason: normalized.reason,
            retryAfter: normalized.retryAfter,
            hasRefreshToken,
            hasAccessToken,
          },
        });
      }
      log("refresh-failed", { message: (err as Error)?.message });
      return respond(502, {
        ok: false,
        code: "GMAIL_UPSTREAM_ERROR",
        message: "Gmail request failed.",
        details: (err as Error)?.message || "Unable to refresh token.",
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
    } catch (err: unknown) {
      const normalized = normalizeGoogleError(err);
      if (normalized) {
        log("gmail-list-failed", { message: normalized.reason, status: normalized.status });
        return respond(normalized.status, {
          ok: false,
          code: normalized.code,
          message: normalized.message,
          details: {
            stage: "list-threads",
            reason: normalized.reason,
            retryAfter: normalized.retryAfter,
            hasRefreshToken,
            hasAccessToken,
          },
        });
      }
      log("gmail-list-failed", { message: (err as Error)?.message });
      return respond(502, {
        ok: false,
        code: "GMAIL_UPSTREAM_ERROR",
        message: "Gmail request failed.",
        details: (err as Error)?.message || "Unable to list threads.",
      });
    }

    let metas: ThreadMeta[] = [];
    try {
      metas = await fetchThreadMetas(accessToken, ids, accountEmail);
    } catch (err: unknown) {
      const normalized = normalizeGoogleError(err);
      if (normalized) {
        log("thread-meta-failed", { message: normalized.reason, status: normalized.status });
        return respond(normalized.status, {
          ok: false,
          code: normalized.code,
          message: normalized.message,
          details: {
            stage: "thread-metadata",
            reason: normalized.reason,
            retryAfter: normalized.retryAfter,
            hasRefreshToken,
            hasAccessToken,
          },
        });
      }
      log("thread-meta-failed", { message: (err as Error)?.message });
      return respond(502, {
        ok: false,
        code: "GMAIL_UPSTREAM_ERROR",
        message: "Gmail request failed.",
        details: (err as Error)?.message || "Unable to load thread metadata.",
      });
    }

    log("response-200", { signedIn, googleConnected, threads: metas.length });
    return respond(200, {
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
    });
  } catch (e: any) {
    console.error("[gmail-threads] unhandled", e);
    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "gmail-threads crashed",
      requestId,
      debug: {
        runtime: runtimeMode,
        ...envFlags,
      },
    });
  }
}
