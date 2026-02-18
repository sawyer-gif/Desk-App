import type { VercelRequest, VercelResponse } from "@vercel/node";

export const runtime = "nodejs";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    runtime: process.env.VERCEL ? "vercel" : "node",
    env: {
      hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasOAuthStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
      hasRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
    },
  });
}
