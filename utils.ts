
import { Bucket, Thread, Message, ActionabilityPrefs } from './types';
import {
  ACTIONABILITY_NO_REPLY_PATTERNS,
  ACTIONABILITY_KEYWORD_BLOCKLIST,
  ACTIONABILITY_DEFAULT_ALLOWLIST,
  ACTIONABILITY_DEFAULT_BLOCKLIST,
} from './config/actionability';

export function formatReceivedTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

  if (diffDays === 0) {
    return date.toLocaleTimeString([], timeOptions);
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'short' });
    return `${weekday} ${date.toLocaleTimeString([], timeOptions)}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function computeWaitingText(days: number, show: boolean): string {
  if (!show) return '';
  return days === 0 ? 'Waiting today' : `Waiting ${days}d`;
}

export function getWaitingColorClass(days: number, show: boolean): string {
  if (!show) return 'text-[#A1A1A6]';
  if (days >= 4) return 'text-[#FF3B30] font-semibold';
  if (days >= 2) return 'text-[#424245] font-semibold';
  return 'text-[#86868B]';
}

export function suggestBucketHeuristic(thread: Thread): { bucket: Bucket; reason: string } | null {
  const content = (thread.subject + " " + thread.snippet).toLowerCase();
  
  const activeKeywords = ['po', 'invoice', 'deposit', 'approval', 'shop drawing', 'revision', 'shipping', 'tracking', 'install', 'schedule', 'change order', 'rfi'];
  const salesKeywords = ['quote', 'pricing', 'estimate', 'proposal', 'sample', 'rendering', 'bid', 'spec', 'rfp', 'intro'];
  const internalKeywords = ['ops', 'accounting', 'production', 'team update', 'payroll', 'meeting'];

  if (activeKeywords.some(kw => content.includes(kw))) {
    return { bucket: Bucket.PROJECTS, reason: "Delivery keyword found (PO/Invoice/Install)" };
  }
  if (salesKeywords.some(kw => content.includes(kw))) {
    return { bucket: Bucket.SALES, reason: "Lead keyword found (Quote/Proposal/Bid)" };
  }
  if (internalKeywords.some(kw => content.includes(kw))) {
    return { bucket: Bucket.INTERNAL, reason: "Ops keyword found" };
  }
  
  return null;
}

/**
 * Detects messages requiring Sawyer's direct attention (Questions/Mentions).
 */
export function detectSawyerQuestions(messages?: Message[] | null): Message[] {
  const messageList: Message[] = Array.isArray(messages) ? messages : [];

  const patterns = [
    /sawyer/i,
    /can you/i,
    /could you/i,
    /do you/i,
    /what do you think/i,
    /confirm/i,
    /sign-off/i,
    /waiting on you/i,
    /let me know/i
  ];

  return messageList.filter(m => {
    // Ignore Sawyer's own messages
    if (!m || !m.sender) return false;
    if (m.sender.toLowerCase().includes('you') || m.senderEmail?.toLowerCase().includes('sawyer')) return false;

    const text = (m.content || '').toLowerCase();
    const hasSawyer = /sawyer/i.test(text);
    const hasQuestionMark = text.includes('?');
    const matchesPattern = patterns.some(p => p.test(text));

    return (hasSawyer && (hasQuestionMark || matchesPattern)) || (hasQuestionMark && text.includes('you'));
  });
}

export function getWaitingStatus(thread: Thread) {
  const waitingDays = thread.awaitingSawyerReply ? thread.daysUnresponded : (thread.daysSinceLastActionable ?? 0);
  const showWaiting = thread.awaitingSawyerReply || thread.bucket === Bucket.WAITING;
  const isOverdue = showWaiting && waitingDays >= 4;
  return { waitingDays, showWaiting, isOverdue };
}

export function isActionableThread(thread: Thread): boolean {
  if (thread.bucket === Bucket.CLEARED || thread.manuallyCleared) return false;
  if (thread.isMuted) return false;
  if (thread.isActionable === false) return false;
  return true;
}

/**
 * Simplified summary extraction for thread insight.
 */
export function getThreadSummary(thread: Thread): string {
  if (thread.bucket === Bucket.UNASSIGNED) {
    return `Inbound query from ${thread.fromName} regarding potential new project. Needs routing.`;
  }
  return `Ongoing discussion about ${thread.project}. Latest focus is on ${thread.subject.toLowerCase()}.`;
}

const normalizeDomain = (input?: string | null) => {
  if (!input) return '';
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed.split('@').pop() || trimmed;
  }
  return trimmed;
};

const uniqueDomains = (domains: string[]) => {
  const set = new Set<string>();
  domains.forEach((domain) => {
    const normalized = normalizeDomain(domain);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

export function evaluateThreadActionability(thread: Thread, prefs?: ActionabilityPrefs | null) {
  const defaultAllow = uniqueDomains(ACTIONABILITY_DEFAULT_ALLOWLIST);
  const defaultBlock = uniqueDomains(ACTIONABILITY_DEFAULT_BLOCKLIST);
  const allowlist = new Set(uniqueDomains([...(prefs?.allowlistDomains || []), ...defaultAllow]));
  const blocklist = new Set(uniqueDomains([...(prefs?.blocklistDomains || []), ...defaultBlock]));

  const domain = normalizeDomain(thread.fromDomain || thread.fromEmail);
  const latestEmail = (thread.meta?.latestExternalEmail || thread.fromEmail || '').toLowerCase();
  const allowlisted = domain && allowlist.has(domain);
  const muted = Boolean(prefs?.mutedThreads?.[thread.id]);

  if (muted) {
    return { isActionable: false, reason: 'muted-by-user', isMuted: true };
  }

  if (domain && blocklist.has(domain)) {
    return { isActionable: false, reason: `domain-blocked:${domain}`, isMuted: false };
  }

  const reasons: string[] = [];
  const meta = thread.meta || {};

  if (!meta.latestExternalEmail && !allowlisted) {
    reasons.push('no-external-message');
  }

  if (!allowlisted && latestEmail && ACTIONABILITY_NO_REPLY_PATTERNS.some((pattern) => latestEmail.includes(pattern))) {
    reasons.push('no-reply-address');
  }

  const autoFlags = meta.autoFlags || [];
  if (!allowlisted && autoFlags.length) {
    reasons.push(...autoFlags);
  }

  const haystack = `${thread.subject} ${thread.snippet}`.toLowerCase();
  if (!allowlisted && ACTIONABILITY_KEYWORD_BLOCKLIST.some((kw) => haystack.includes(kw))) {
    reasons.push('keyword-match');
  }

  const actionable = allowlisted || reasons.length === 0;

  return {
    isActionable: actionable,
    reason: actionable ? null : reasons[0],
    isMuted: false,
  };
}
