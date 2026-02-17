export const ACTIONABILITY_NO_REPLY_PATTERNS = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
];

export const ACTIONABILITY_KEYWORD_BLOCKLIST = [
  "payment processed",
  "receipt",
  "invoice",
  "account has been funded",
  "billing",
  "usage limits",
  "subscription",
  "notification",
  "security advisory",
  "inventory",
  "shipment",
  "delivered",
  "statement",
  "alert",
  "policy update",
  "verification code",
  "password",
  "confirm your",
  "do not reply",
  "your api",
];

export const ACTIONABILITY_SYSTEM_KEYWORDS = [
  "payment processed",
  "receipt",
  "invoice",
  "account has been funded",
  "usage limits",
  "your api",
  "verification code",
  "security alert",
  "password",
  "confirm your",
  "subscription",
  "auto-reply",
  "billing",
  "statement",
  "notification",
];

export const ACTIONABILITY_SENDER_KEYWORDS = [
  "billing",
  "receipt",
  "invoice",
  "subscription",
  "auto-reply",
  "support",
];

export const ACTIONABILITY_DOMAIN_BLOCKLIST = [
  "zoom.us",
  "tm.openai.com",
  "openai.com",
  "stripe.com",
  "mailchimp.com",
  "sendgrid.net",
  "hubspot.com",
  "intercom.com",
  "flow.space",
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

export const GMAIL_EXCLUDED_LABELS = [
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
  'SPAM',
  'TRASH',
  'DRAFT',
];
