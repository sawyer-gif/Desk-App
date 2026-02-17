export const ACTIONABILITY_NO_REPLY_PATTERNS = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "automated",
];

export const ACTIONABILITY_KEYWORD_BLOCKLIST = [
  "payment processed",
  "receipt",
  "invoice",
  "billing",
  "notification",
  "security advisory",
  "inventory",
  "shipment",
  "delivered",
  "statement",
  "alert",
  "policy update",
];

export const ACTIONABILITY_DEFAULT_ALLOWLIST = [
  "gensler.com",
  "hksinc.com",
  "pmg.com",
  "marioromano.com",
  "mrwalls.com",
];

export const ACTIONABILITY_DEFAULT_BLOCKLIST = [
  "zoom.us",
  "flow.space",
  "cloudplatform-noreply@google.com",
  "accounts.google.com",
  "notifications.google.com",
];
