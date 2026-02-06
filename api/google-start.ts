import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { verifyToken } from "@clerk/backend";


function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function signState(payload: string) {
  const secret = requireEnv("OAUTH_STATE_SECRET");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    // Verify Clerk session token
    const verified = await verifyToken(token, {
      secretKey: requireEnv("CLERK_SECRET_KEY"),
    });

    const userId = verified.sub;
    if (!userId) return res.status(401).json({ error: "No userId in token" });

    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");

    // State = userId + timestamp, signed to prevent tampering
    const rawState = `${userId}:${Date.now()}`;
    const state = signState(rawState);

    const scope = encodeURIComponent(
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" ")
    );

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&include_granted_scopes=true` +
      `&state=${encodeURIComponent(state)}`;

    return res.status(200).json({ url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
