import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const hasClerk = Boolean(process.env.CLERK_SECRET_KEY);
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasGoogleSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  res.status(200).json({ ok: true, hasClerk, hasGoogle, hasGoogleSecret });
}
