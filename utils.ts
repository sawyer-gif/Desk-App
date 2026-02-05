
import { Bucket, Thread, Message } from './types';

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

export function computeWaitingText(days: number, awaiting: boolean): string {
  if (!awaiting) return '';
  return days === 0 ? 'Waiting today' : `Waiting ${days}d`;
}

export function getWaitingColorClass(days: number, awaiting: boolean): string {
  if (!awaiting) return 'text-[#A1A1A6]';
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
export function detectSawyerQuestions(messages: Message[]): Message[] {
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

  return messages.filter(m => {
    // Ignore Sawyer's own messages
    if (m.sender.toLowerCase().includes('you') || m.senderEmail.toLowerCase().includes('sawyer')) return false;

    const text = m.content.toLowerCase();
    const hasSawyer = /sawyer/i.test(text);
    const hasQuestionMark = text.includes('?');
    const matchesPattern = patterns.some(p => p.test(text));

    return (hasSawyer && (hasQuestionMark || matchesPattern)) || (hasQuestionMark && text.includes('you'));
  });
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
