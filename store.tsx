
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState, Action, Bucket, Thread, RoutingRule, ManualClearedMap, ActionabilityPrefs } from './types';
import { evaluateThreadActionability } from './utils';

const DETAIL_WIDTH_KEY = 'desk-detail-panel-width';
const DETAIL_COLLAPSE_KEY = 'desk-detail-panel-collapsed';
const MANUAL_CLEAR_KEY = 'desk-manual-cleared';
const DARK_MODE_KEY = 'desk-dark-mode';
const AUTH_KEY = 'desk-auth';
const ACTIONABILITY_PREFS_KEY = 'desk-actionability-prefs';

export const DETAIL_PANEL_MIN_WIDTH = 360;
export const DETAIL_PANEL_MAX_WIDTH = 760;
const DEFAULT_DETAIL_PANEL_WIDTH = 520;

const readBoolean = (key: string, fallback = false) => {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) === 'true';
};

const readNumber = (key: string, fallback: number) => {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  if (Number.isNaN(value)) return fallback;
  return value;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const loadManualCleared = (): ManualClearedMap => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(MANUAL_CLEAR_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('[Desk] Failed to parse manual cleared overrides', err);
    return {};
  }
};

const persistManualCleared = (map: ManualClearedMap) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MANUAL_CLEAR_KEY, JSON.stringify(map));
};

const defaultActionabilityPrefs: ActionabilityPrefs = {
  mutedThreads: {},
  allowlistDomains: [],
  blocklistDomains: [],
};

const loadActionabilityPrefs = (): ActionabilityPrefs => {
  if (typeof window === 'undefined') return defaultActionabilityPrefs;
  try {
    const stored = localStorage.getItem(ACTIONABILITY_PREFS_KEY);
    if (!stored) return defaultActionabilityPrefs;
    const parsed = JSON.parse(stored);
    return {
      mutedThreads: parsed?.mutedThreads || {},
      allowlistDomains: Array.isArray(parsed?.allowlistDomains) ? parsed.allowlistDomains : [],
      blocklistDomains: Array.isArray(parsed?.blocklistDomains) ? parsed.blocklistDomains : [],
    } as ActionabilityPrefs;
  } catch (err) {
    console.warn('[Desk] Failed to load actionability prefs', err);
    return defaultActionabilityPrefs;
  }
};

const persistActionabilityPrefs = (prefs: ActionabilityPrefs) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIONABILITY_PREFS_KEY, JSON.stringify(prefs));
};

const persistDetailWidth = (width: number) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DETAIL_WIDTH_KEY, String(width));
};

const persistDetailCollapsed = (collapsed: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DETAIL_COLLAPSE_KEY, String(collapsed));
};

const initialState: AppState = {
  isAuthenticated: readBoolean(AUTH_KEY),
  threads: [],
  routingRules: [],
  selectedThreadId: null,
  currentView: { type: 'DASHBOARD' },
  isSyncing: false,
  lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  searchQuery: '',
  dateRange: '14 Days',
  isDraftModalOpen: false,
  expandedBuckets: new Set(),
  darkMode: readBoolean(DARK_MODE_KEY),
  manualClearedMap: loadManualCleared(),
  detailPanelWidth: clamp(readNumber(DETAIL_WIDTH_KEY, DEFAULT_DETAIL_PANEL_WIDTH), DETAIL_PANEL_MIN_WIDTH, DETAIL_PANEL_MAX_WIDTH),
  isDetailPanelCollapsed: readBoolean(DETAIL_COLLAPSE_KEY, false),
  syncMeta: null,
  actionabilityPrefs: loadActionabilityPrefs(),
  googleStatus: 'UNKNOWN',
};

function computeActionableMeta(thread: Thread) {
  const lastInbound = thread.lastInboundAt ? new Date(thread.lastInboundAt).getTime() : null;
  const lastOutbound = thread.lastOutboundAt ? new Date(thread.lastOutboundAt).getTime() : null;
  const awaiting = thread.awaitingSawyerReply;

  let actionableTimestamp: number | null = null;
  if (awaiting && lastInbound) {
    actionableTimestamp = lastInbound;
  } else if (!awaiting && lastOutbound) {
    actionableTimestamp = lastOutbound;
  } else if (lastInbound) {
    actionableTimestamp = lastInbound;
  }

  const lastActionableAt = actionableTimestamp ? new Date(actionableTimestamp).toISOString() : null;
  const daysSinceLastActionable = actionableTimestamp
    ? Math.floor((Date.now() - actionableTimestamp) / (1000 * 60 * 60 * 24))
    : 0;

  const daysUnresponded = awaiting && lastInbound
    ? Math.floor((Date.now() - lastInbound) / (1000 * 60 * 60 * 24))
    : 0;

  return { daysUnresponded, lastActionableAt, daysSinceLastActionable };
}

function reevaluateThreadState(
  thread: Thread,
  rules: RoutingRule[],
  manualCleared: ManualClearedMap,
  actionabilityPrefs: ActionabilityPrefs
): Thread {
  const lastInbound = thread.lastInboundAt ? new Date(thread.lastInboundAt).getTime() : 0;
  const lastOutbound = thread.lastOutboundAt ? new Date(thread.lastOutboundAt).getTime() : 0;
  
  const hasRepliedExternally = lastOutbound > lastInbound && lastOutbound !== 0;
  
  let awaitingReply = thread.awaitingSawyerReply;
  if (hasRepliedExternally) {
    awaitingReply = false;
  }

  let followUp = thread.followUpAt;
  if (hasRepliedExternally) {
    followUp = null;
  }

  let bucket = thread.bucket;
  if (bucket === Bucket.UNASSIGNED) {
    const rule = rules.find(r => r.senderEmail === thread.fromEmail);
    if (rule) bucket = rule.targetBucket;
  }

  const { daysUnresponded, lastActionableAt, daysSinceLastActionable } = computeActionableMeta({ ...thread, bucket, awaitingSawyerReply: awaitingReply });

  const manualMeta = manualCleared[thread.id];
  if (manualMeta) {
    bucket = Bucket.CLEARED;
  }

  const baseThread = {
    ...thread,
    bucket,
    awaitingSawyerReply: awaitingReply,
    followUpAt: followUp,
    daysUnresponded,
    lastActionableAt,
    daysSinceLastActionable,
    manuallyCleared: Boolean(manualMeta),
    originalBucket: manualMeta ? manualMeta.bucket : thread.originalBucket || null,
  };

  const actionability = evaluateThreadActionability(baseThread, actionabilityPrefs);

  return {
    ...baseThread,
    isActionable: actionability.isActionable,
    nonActionableReason: actionability.reason || null,
    isMuted: actionability.isMuted,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem(AUTH_KEY, 'true');
      return { ...state, isAuthenticated: true };
    case 'LOGOUT':
      localStorage.removeItem(AUTH_KEY);
      return { ...state, isAuthenticated: false };
    case 'SET_THREADS': {
      const incoming = Array.isArray(action.payload) ? action.payload : [];
      const normalized = recomputeThreads(incoming, state);
      return { ...state, threads: normalized };
    }
    case 'SET_THREAD_MESSAGES': {
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.payload.threadId ? { ...t, messages: action.payload.messages } : t
        ),
      };
    }
    case 'SET_LAST_SYNC_TIME':
      return {
        ...state,
        lastSyncTime: action.payload,
      };
    case 'NAVIGATE':
      return { ...state, currentView: action.payload, selectedThreadId: null };
    case 'MOVE_THREAD': {
      const thread = state.threads.find(t => t.id === action.payload.id);
      let nextRules = state.routingRules;
      if (action.payload.applyRule && thread) {
        nextRules = [...state.routingRules.filter(r => r.senderEmail !== thread.fromEmail), {
          senderEmail: thread.fromEmail,
          targetBucket: action.payload.bucket
        }];
      }
      let nextManualCleared = state.manualClearedMap;
      if (nextManualCleared[action.payload.id]) {
        nextManualCleared = { ...nextManualCleared };
        delete nextManualCleared[action.payload.id];
        persistManualCleared(nextManualCleared);
      }
      const updatedThreads = state.threads.map((t) =>
        t.id === action.payload.id
          ? {
              ...t,
              bucket: action.payload.bucket,
              manuallyCleared: false,
              originalBucket: null,
            }
          : t
      );
      const baseState = {
        ...state,
        routingRules: nextRules,
        manualClearedMap: nextManualCleared,
      };
      return {
        ...baseState,
        threads: recomputeThreads(updatedThreads, baseState),
      };
    }
    case 'SELECT_THREAD': {
      const shouldOpenPanel = Boolean(action.payload);
      if (shouldOpenPanel) {
        persistDetailCollapsed(false);
      }
      return {
        ...state,
        selectedThreadId: action.payload,
        isDetailPanelCollapsed: shouldOpenPanel ? false : state.isDetailPanelCollapsed,
      };
    }
    case 'SET_SYNCING':
      return { 
        ...state, 
        isSyncing: action.payload, 
        lastSyncTime: action.payload ? state.lastSyncTime : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
    case 'PERFORM_SYNC':
      return {
        ...state,
        threads: recomputeThreads(state.threads, state),
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    case 'ADD_ROUTING_RULE':
      return {
        ...state,
        routingRules: [...state.routingRules.filter(r => r.senderEmail !== action.payload.senderEmail), action.payload]
      };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'TOGGLE_DRAFT_MODAL':
      return { ...state, isDraftModalOpen: action.payload };
    case 'TOGGLE_BUCKET_EXPAND':
      const nextExpanded = new Set(state.expandedBuckets);
      if (nextExpanded.has(action.payload)) {
        nextExpanded.delete(action.payload);
      } else {
        nextExpanded.add(action.payload);
      }
      return { ...state, expandedBuckets: nextExpanded };
    case 'ARCHIVE_THREAD': {
      const updatedThreads = state.threads.map((t) =>
        t.id === action.payload ? { ...t, bucket: Bucket.CLEARED } : t
      );
      return {
        ...state,
        threads: recomputeThreads(updatedThreads, state),
      };
    }
    case 'SET_FOLLOW_UP':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.payload.id ? { ...t, followUpAt: action.payload.date } : t
        ),
      };
    case 'SET_PRIORITY':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.payload.id ? { ...t, priority: action.payload.priority } : t
        ),
      };
    case 'TOGGLE_PIN':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.payload ? { ...t, pinned: !t.pinned } : t
        ),
      };
    case 'TOGGLE_QUESTION_ANSWERED':
      return {
        ...state,
        threads: state.threads.map((t) => {
          if (t.id !== action.payload.threadId) return t;
          const currentAnswered = t.answeredQuestionIds || [];
          const isAnswered = currentAnswered.includes(action.payload.messageId);
          return {
            ...t,
            answeredQuestionIds: isAnswered 
              ? currentAnswered.filter(id => id !== action.payload.messageId)
              : [...currentAnswered, action.payload.messageId]
          };
        })
      };
    case 'TOGGLE_DARK_MODE':
      const nextDarkMode = !state.darkMode;
      localStorage.setItem(DARK_MODE_KEY, String(nextDarkMode));
      return { ...state, darkMode: nextDarkMode };
    case 'SET_DETAIL_PANEL_WIDTH': {
      const clamped = clamp(action.payload, DETAIL_PANEL_MIN_WIDTH, DETAIL_PANEL_MAX_WIDTH);
      persistDetailWidth(clamped);
      return { ...state, detailPanelWidth: clamped };
    }
    case 'SET_DETAIL_PANEL_OPEN': {
      const nextCollapsed = !action.payload;
      persistDetailCollapsed(nextCollapsed);
      return { ...state, isDetailPanelCollapsed: nextCollapsed };
    }
    case 'TOGGLE_DETAIL_PANEL': {
      const next = !state.isDetailPanelCollapsed;
      persistDetailCollapsed(next);
      return { ...state, isDetailPanelCollapsed: next };
    }
    case 'TOGGLE_MANUAL_CLEAR': {
      const { threadId } = action.payload;
      const isActive = Boolean(state.manualClearedMap[threadId]);
      const nextManual = { ...state.manualClearedMap };
      let nextThreads = state.threads;

      if (isActive) {
        delete nextManual[threadId];
        nextThreads = nextThreads.map(thread =>
          thread.id === threadId
            ? {
                ...thread,
                manuallyCleared: false,
                bucket: thread.originalBucket || thread.bucket || Bucket.UNASSIGNED,
                originalBucket: null,
              }
            : thread
        );
      } else {
        const targetThread = state.threads.find(t => t.id === threadId);
        const originalBucket = targetThread?.bucket ?? Bucket.UNASSIGNED;
        nextManual[threadId] = { bucket: originalBucket };
        nextThreads = nextThreads.map(thread =>
          thread.id === threadId
            ? {
                ...thread,
                manuallyCleared: true,
                originalBucket,
                bucket: Bucket.CLEARED,
              }
            : thread
        );
      }

      persistManualCleared(nextManual);
      const baseState = { ...state, manualClearedMap: nextManual };
      return {
        ...baseState,
        threads: recomputeThreads(nextThreads, baseState),
      };
    }
    case 'SET_SYNC_META':
      return {
        ...state,
        syncMeta: action.payload,
      };
    case 'SET_GOOGLE_STATUS':
      return {
        ...state,
        googleStatus: action.payload,
      };
    case 'TOGGLE_THREAD_MUTE': {
      const threadId = action.payload.threadId;
      const mutedThreads = { ...state.actionabilityPrefs.mutedThreads };
      if (mutedThreads[threadId]) {
        delete mutedThreads[threadId];
      } else {
        mutedThreads[threadId] = {
          reason: action.payload.reason,
          createdAt: new Date().toISOString(),
        };
      }
      const nextPrefs: ActionabilityPrefs = {
        ...state.actionabilityPrefs,
        mutedThreads,
      };
      persistActionabilityPrefs(nextPrefs);
      const baseState = { ...state, actionabilityPrefs: nextPrefs };
      return {
        ...baseState,
        threads: recomputeThreads(state.threads, baseState, nextPrefs),
      };
    }
    case 'ADD_ALLOWLIST_DOMAIN': {
      const domain = (action.payload || '').trim().toLowerCase();
      if (!domain) return state;
      if (state.actionabilityPrefs.allowlistDomains.includes(domain)) return state;
      const nextPrefs: ActionabilityPrefs = {
        ...state.actionabilityPrefs,
        allowlistDomains: [...state.actionabilityPrefs.allowlistDomains, domain],
      };
      persistActionabilityPrefs(nextPrefs);
      const baseState = { ...state, actionabilityPrefs: nextPrefs };
      return {
        ...baseState,
        threads: recomputeThreads(state.threads, baseState, nextPrefs),
      };
    }
    case 'REMOVE_ALLOWLIST_DOMAIN': {
      const domain = (action.payload || '').trim().toLowerCase();
      const nextPrefs: ActionabilityPrefs = {
        ...state.actionabilityPrefs,
        allowlistDomains: state.actionabilityPrefs.allowlistDomains.filter((d) => d !== domain),
      };
      persistActionabilityPrefs(nextPrefs);
      const baseState = { ...state, actionabilityPrefs: nextPrefs };
      return {
        ...baseState,
        threads: recomputeThreads(state.threads, baseState, nextPrefs),
      };
    }
    case 'ADD_BLOCKLIST_DOMAIN': {
      const domain = (action.payload || '').trim().toLowerCase();
      if (!domain) return state;
      if (state.actionabilityPrefs.blocklistDomains.includes(domain)) return state;
      const nextPrefs: ActionabilityPrefs = {
        ...state.actionabilityPrefs,
        blocklistDomains: [...state.actionabilityPrefs.blocklistDomains, domain],
      };
      persistActionabilityPrefs(nextPrefs);
      const baseState = { ...state, actionabilityPrefs: nextPrefs };
      return {
        ...baseState,
        threads: recomputeThreads(state.threads, baseState, nextPrefs),
      };
    }
    case 'REMOVE_BLOCKLIST_DOMAIN': {
      const domain = (action.payload || '').trim().toLowerCase();
      const nextPrefs: ActionabilityPrefs = {
        ...state.actionabilityPrefs,
        blocklistDomains: state.actionabilityPrefs.blocklistDomains.filter((d) => d !== domain),
      };
      persistActionabilityPrefs(nextPrefs);
      const baseState = { ...state, actionabilityPrefs: nextPrefs };
      return {
        ...baseState,
        threads: recomputeThreads(state.threads, baseState, nextPrefs),
      };
    }
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

const recomputeThreads = (threads: Thread[], state: AppState, prefs?: ActionabilityPrefs) => {
  const activePrefs = prefs || state.actionabilityPrefs;
  return threads.map((thread) =>
    reevaluateThreadState(thread, state.routingRules, state.manualClearedMap, activePrefs)
  );
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const controller = new AbortController();
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/google/status', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('status failed');
        const data = await res.json();
        dispatch({ type: 'SET_GOOGLE_STATUS', payload: data?.connected ? 'CONNECTED' : 'NOT_CONNECTED' });
      } catch (err) {
        if (controller.signal.aborted) return;
        dispatch({ type: 'SET_GOOGLE_STATUS', payload: 'NOT_CONNECTED' });
      }
    };
    fetchStatus();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'PERFORM_SYNC' });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppState must be used within an AppProvider');
  return context;
};
