import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    env: {
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasOAuthStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
    },
  });
}
