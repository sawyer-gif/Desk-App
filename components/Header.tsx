import React from 'react';
import { useAuth } from "@clerk/clerk-react";
import { useAppState } from '../store';
import { Search, RefreshCw, ChevronLeft, Moon, Sun, LogOut } from 'lucide-react';
import { Bucket, Priority, Thread, DateRange } from '../types';

const parseEmailAddress = (raw: string) => {
  if (!raw) return { name: '', email: '' };
  const match = raw.match(/<([^>]+)>/);
  const email = match?.[1] || raw;
  const name = raw.split('<')[0]?.trim() || email;
  return { name, email };
};

const deriveCompanyFromEmail = (email: string) => {
  if (!email || !email.includes('@')) return '';
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (!domain) return '';
  const core = domain.split('.')[0] || domain;
  if (!core) return '';
  return core
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const inferBucket = (email: string) => {
  if (!email) return Bucket.SALES;
  const normalized = email.toLowerCase();
  if (normalized.includes('@marioromano.com')) return Bucket.INTERNAL;
  if (normalized.includes('@mrwalls')) return Bucket.INTERNAL;
  return Bucket.SALES;
};

const rangeToDays = (range: DateRange): number => {
  switch (range) {
    case 'Today':
      return 1;
    case '7 Days':
      return 7;
    case '60 Days':
      return 60;
    case '30 Days':
      return 30;
    case '14 Days':
      return 14;
    default:
      return 30;
  }
};

const normalizeThreads = (threads: any[]): Thread[] => {
  return (threads ?? []).map((t) => {
    const { name, email } = parseEmailAddress(t.from ?? '');
    const inboundDate = t.date ? new Date(t.date) : new Date();
    const subject = t.subject ?? '(no subject)';
    const domain = email?.includes('@') ? email.split('@')[1] : '';

    return {
      id: t.id,
      subject,
      fromEmail: email,
      fromName: name || email || 'Unknown sender',
      fromCompany: deriveCompanyFromEmail(email),
      fromDomain: domain,
      project: subject,
      actionPhrase: undefined,
      contextTag: 'Lead',
      snippet: t.snippet ?? '',
      unread: true,
      priority: 'Normal',
      bucket: inferBucket(email),
      messages: [],
      suggestedDraft: undefined,
      labels: [],
      reason: undefined,
      lastInboundAt: inboundDate.toISOString(),
      lastOutboundAt: null,
      awaitingSawyerReply: true,
      daysUnresponded: 0,
      followUpAt: null,
      pinned: false,
      hasAttachments: false,
      answeredQuestionIds: [],
      manuallyCleared: false,
      originalBucket: null,
      lastActionableAt: inboundDate.toISOString(),
      daysSinceLastActionable: 0,
      meta: t.meta || undefined,
    } as Thread;
  });
};

export const Header: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { getToken } = useAuth();

  const handleSync = async (rangeOverride?: DateRange) => {
    if (state.isSyncing) return;

    const activeRange = rangeOverride ?? state.dateRange ?? '30 Days';
    const rangeDays = rangeToDays(activeRange);

    try {
      dispatch({ type: "SET_SYNCING", payload: true });

      const token = await getToken();
      if (!token) {
        alert('Sign in to sync.');
        return;
      }

      const params = new URLSearchParams({
        ts: Date.now().toString(),
        days: String(rangeDays),
      });

      const res = await fetch(`/api/google/gmail-threads?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        console.error('[Desk] Sync error', { status: res.status, body: data });
        if ((res.status === 401 || data?.code === 'AUTH_REQUIRED')) {
          alert('Please sign in to sync.');
          return;
        }
        if ((res.status === 403 || data?.code === 'GOOGLE_NOT_CONNECTED')) {
          alert('Google account not connected. Use the Connect Google button to link your account.');
          return;
        }
        const code = data?.code || res.status;
        alert(`Sync failed: ${code}. See console for details.`);
        return;
      }

      const normalizedThreads = normalizeThreads(data?.threads ?? []);

      dispatch({ type: "SET_THREADS", payload: normalizedThreads });
      dispatch({ type: "PERFORM_SYNC" });
      dispatch({
        type: "SET_LAST_SYNC_TIME",
        payload: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      dispatch({
        type: 'SET_SYNC_META',
        payload: {
          range: activeRange,
          rangeDays,
          totalFetched: data?.meta?.totalFetched ?? normalizedThreads.length,
          pages: data?.meta?.pages ?? 1,
          pageSize: data?.meta?.pageSize ?? 0,
          capped: Boolean(data?.meta?.capped),
          primaryOnly: Boolean(data?.meta?.primaryOnly),
          estimate: data?.meta?.estimate,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Sync failed. Try again.");
    } finally {
      dispatch({ type: "SET_SYNCING", payload: false });
    }
  };


  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };
const connectGoogle = async () => {
  try {
    const token = await getToken();

    const res = await fetch("/api/google/google-start?ts=" + Date.now(), {

      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      alert("Google connect failed: " + txt);
      return;
    }

    const data = await res.json();
    window.location.href = data.url;

  } catch (err) {
    console.error(err);
    alert("Google connect error");
  }
};

  const handleRangeSelect = (range: DateRange) => {
    dispatch({ type: 'SET_DATE_RANGE', payload: range });
    if (!state.isSyncing) {
      handleSync(range);
    }
  };

  const isDashboard = state.currentView.type === 'DASHBOARD';

  return (
    <header className="glass sticky top-0 z-50 px-8 py-4 flex items-center justify-between dark:bg-desk-surface-dark/80 dark:border-white/5">
      <div className="flex items-center gap-6">
        {!isDashboard && (
          <button 
            onClick={() => dispatch({ type: 'NAVIGATE', payload: { type: 'DASHBOARD' } })}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors mr-2"
          >
            <ChevronLeft className="w-5 h-5 text-desk-text-secondary-light dark:text-desk-text-secondary-dark" />
          </button>
        )}
        <div className="flex flex-col">
          <h1 className="text-[20px] font-bold tracking-tight text-desk-text-primary-light dark:text-desk-text-primary-dark">Desk</h1>
          <p className="text-[10px] text-desk-text-secondary-light dark:text-desk-text-secondary-dark font-bold tracking-widest uppercase mt-[-1px]">Sawyer's Command</p>
        </div>

        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl ml-4">
          {(['Today', '7 Days', '14 Days', '30 Days', '60 Days'] as const).map((range) => (
            <button
              key={range}
              onClick={() => handleRangeSelect(range)}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                state.dateRange === range 
                  ? 'bg-desk-surface-light shadow-sm text-desk-text-primary-light dark:bg-white/10 dark:text-desk-text-primary-dark' 
                  : 'text-desk-text-secondary-light hover:text-desk-text-primary-light dark:text-desk-text-secondary-dark dark:hover:text-desk-text-primary-dark'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 flex-1 max-w-md mx-12">
        <div className="relative w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-desk-text-secondary-light dark:text-desk-text-secondary-dark" />
          <input
            type="text"
            placeholder="Find threads, projects..."
            className="w-full bg-black/5 dark:bg-white/5 dark:text-desk-text-primary-dark border-none rounded-2xl py-2 pl-10 pr-4 text-[13px] focus:ring-2 focus:ring-black/5 outline-none transition-all placeholder:text-desk-text-secondary-light/60 dark:placeholder:text-desk-text-secondary-dark/60"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
          className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-desk-text-secondary-light dark:text-desk-text-secondary-dark"
          title="Toggle Dark Mode"
        >
          {state.darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-desk-text-secondary-light hover:text-red-500 dark:text-desk-text-secondary-dark dark:hover:text-red-400"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-black/5 dark:bg-white/5 mx-2" />
        <button
          onClick={connectGoogle}
          className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
      >
          Connect Google
        </button>

        <button
          onClick={() => handleSync()}
          disabled={state.isSyncing}
          className="bg-desk-text-primary-light dark:bg-desk-text-primary-dark dark:text-desk-surface-dark text-desk-surface-light px-4 py-2 rounded-xl text-[12px] font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:bg-desk-text-secondary-light/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state.isSyncing ? 'animate-spin' : ''}`} />
          {state.isSyncing ? 'Syncing' : 'Sync'}
        </button>
      </div>
    </header>
  );
};