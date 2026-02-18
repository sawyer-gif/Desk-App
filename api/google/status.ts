import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken, createClerkClient } from "@clerk/backend";

export const runtime = "nodejs";

const SESSION_COOKIE_KEYS = ["__session", "__clerk_session"];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sessionToken = readSessionToken(req.headers.cookie);
    if (!sessionToken) {
      return res.status(200).json({ connected: false, reason: 'NO_SESSION' });
    }

    const verified = await verifyToken(sessionToken, {
      secretKey: requireEnv("CLERK_SECRET_KEY"),
    });

    const userId = verified?.sub;
    if (!userId) {
      return res.status(200).json({ connected: false, reason: 'INVALID_SESSION' });
    }

    const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
    const user = await clerk.users.getUser(userId);
    const gmail = (user.privateMetadata as any)?.google?.gmail;
    const connected = Boolean(gmail?.connected && gmail?.refresh_token);

    return res.status(200).json({ connected, email: gmail?.email || null });
  } catch (error: any) {
    console.error('[Desk][status]', error);
    return res.status(200).json({ connected: false, error: error?.message || 'Unknown error' });
  }
}
