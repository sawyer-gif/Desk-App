import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // TODO: replace this with your real "do we have tokens?" check
    const connected = false;

    return res.status(200).json({ connected });
  } catch (e: any) {
    return res.status(200).json({ connected: false, error: String(e?.message || e) });
  }
}
