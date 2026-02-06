import React from 'react';
import { useAuth } from "@clerk/clerk-react";
import { useAppState } from '../store';
import { Search, RefreshCw, ChevronLeft, Moon, Sun, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { state, dispatch } = useAppState();
   const { getToken } = useAuth();

  const handleSync = async () => {
  try {
    dispatch({ type: "SET_SYNCING", payload: true });

    // Get your Clerk session token (frontend)
    const token = await getToken();
    if (!token) throw new Error("No Clerk session token found");

    // Call your Vercel API route that reads Gmail
    const res = await fetch("/api/google/gmail-threads?ts=" + Date.now(), {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
  cache: "no-store",
});



    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    const data = await res.json();

const normalizedThreads = (data.threads ?? []).map((t: any) => {
  const ts = t.date ? new Date(t.date).getTime() : Date.now();

 

  return {
    id: t.id,
    subject: t.subject ?? "(no subject)",
    fromEmail: (t.from ?? "").match(/<([^>]+)>/)?.[1] || t.from || "",
    fromName: (t.from ?? "").split("<")[0]?.trim() || t.from || "",
    preview: t.snippet ?? "",
    lastInboundAt: ts,
    lastOutboundAt: 0,
    messageCount: t.messageCount ?? 1,

    // your app logic uses these a lot — set safe defaults:
    bucket: (t.from ?? "").includes("@marioromano.com") ? "Internal" : "Sales",
    pinned: false,
    awaitingSawyerReply: true,
    followUpAt: null,
    answeredQuestionIds: [],
  };
});

dispatch({ type: "SET_THREADS", payload: normalizedThreads });
dispatch({ type: "PERFORM_SYNC" }); // keeps your “bucket state” logic consistent
dispatch({ type: "SET_LAST_SYNC_TIME", payload: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });



  } catch (err) {
    console.error(err);
    alert("Sync failed — check console/logs");
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
          {(['Today', '7 Days', '30 Days', '60 Days'] as const).map((range) => (
            <button
              key={range}
              onClick={() => dispatch({ type: 'SET_DATE_RANGE', payload: range })}
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
          onClick={() => {
          alert("SYNC CLICKED");
          handleSync();
      }}

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