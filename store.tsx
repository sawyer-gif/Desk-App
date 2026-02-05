
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState, Action, Bucket, Thread, RoutingRule } from './types';
import { MOCK_THREADS } from './constants';

const initialState: AppState = {
  isAuthenticated: localStorage.getItem('desk-auth') === 'true',
  threads: MOCK_THREADS,
  routingRules: [],
  selectedThreadId: null,
  currentView: { type: 'DASHBOARD' },
  isSyncing: false,
  lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  searchQuery: '',
  dateRange: '7 Days',
  isDraftModalOpen: false,
  expandedBuckets: new Set(),
  darkMode: localStorage.getItem('desk-dark-mode') === 'true',
};

function reevaluateThreadState(thread: Thread, rules: RoutingRule[]): Thread {
  const lastInbound = new Date(thread.lastInboundAt).getTime();
  const lastOutbound = thread.lastOutboundAt ? new Date(thread.lastOutboundAt).getTime() : 0;
  
  const hasRepliedExternally = lastOutbound > lastInbound;
  
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

  return {
    ...thread,
    bucket,
    awaitingSawyerReply: awaitingReply,
    followUpAt: followUp,
    daysUnresponded: awaitingReply ? Math.floor((Date.now() - lastInbound) / (1000 * 60 * 60 * 24)) : 0
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('desk-auth', 'true');
      return { ...state, isAuthenticated: true };
    case 'LOGOUT':
      localStorage.removeItem('desk-auth');
      return { ...state, isAuthenticated: false };
    case 'SET_THREADS':
      return { ...state, threads: action.payload };
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
      return {
        ...state,
        routingRules: nextRules,
        threads: state.threads.map((t) =>
          t.id === action.payload.id ? { ...t, bucket: action.payload.bucket } : t
        ),
      };
    }
    case 'SELECT_THREAD':
      return { ...state, selectedThreadId: action.payload };
    case 'SET_SYNCING':
      return { 
        ...state, 
        isSyncing: action.payload, 
        lastSyncTime: action.payload ? state.lastSyncTime : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
    case 'PERFORM_SYNC':
      return {
        ...state,
        threads: state.threads.map(t => reevaluateThreadState(t, state.routingRules)),
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
    case 'ARCHIVE_THREAD':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.payload ? { ...t, bucket: Bucket.CLEARED } : t
        ),
      };
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
      localStorage.setItem('desk-dark-mode', String(nextDarkMode));
      return { ...state, darkMode: nextDarkMode };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

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
