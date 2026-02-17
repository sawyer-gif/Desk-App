
import React, { useState } from 'react';
import { useAppState } from '../store';
import { Thread, Priority } from '../types';
import { ThreadTile } from './ThreadTile';
import { ChevronRight, Zap, Inbox, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { getWaitingStatus, isActionableThread } from '../utils';

export const FocusActionView: React.FC = () => {
  const { state } = useAppState();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['do-now', 'needs-reply', 'follow-ups']));

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  // Guard: prevent blank-screen if threads is ever undefined/non-array
const threads: Thread[] = Array.isArray((state as any).threads) ? ((state as any).threads as Thread[]) : [];
const actionable = threads.filter(isActionableThread);
const actionableCount = actionable.length;
const totalThreads = threads.length;
const syncMeta = state.syncMeta;


  // Logic: 
  // 1. Do Now: (Overdue >= 4d OR Follow-up passed) AND Priority High
  // 2. Needs Reply: awaitingSawyerReply AND NOT in Do Now
  // 3. Follow-Ups: tracked (followUpAt) AND awaitingSawyerReply == false

  const now = new Date();
  
  const doNow = actionable.filter(t => {
    const { waitingDays, showWaiting } = getWaitingStatus(t);
    const isOverdue = showWaiting && waitingDays >= 4;
    const isFollowUpPassed = t.followUpAt && new Date(t.followUpAt) < now;
    return (isOverdue || isFollowUpPassed) && t.priority === 'High';
  });

  const needsReply = actionable.filter(t => t.awaitingSawyerReply && !doNow.find(dn => dn.id === t.id));
  
  const followUps = actionable.filter(t => t.followUpAt !== null && !t.awaitingSawyerReply);

  const priorityOrder: Record<Priority, number> = { 'High': 0, 'Normal': 1, 'Low': 2 };
  const sortThreads = (arr: Thread[]) => [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const renderSection = (id: string, title: string, icon: React.ReactNode, threads: Thread[], colorClass: string) => {
    const isExpanded = expandedSections.has(id);
    const sorted = sortThreads(threads);
    const displayed = isExpanded ? sorted : sorted.slice(0, 5);
    const hasMore = threads.length > 5;

    return (
      <section className="mb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div 
          onClick={() => toggleSection(id)}
          className="flex items-center justify-between mb-4 group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${colorClass} bg-opacity-10`}>
              {/* Fix: Added type cast to React.ReactElement<any> to resolve cloneElement props error */}
              {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: `w-4 h-4 ${colorClass.replace('bg-', 'text-')}` })}
            </div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] dark:text-zinc-100 tracking-tight">{title}</h2>
            <span className="text-[12px] font-bold text-[#86868B] bg-[#E8E8ED] dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {threads.length}
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>

        <div className="space-y-1.5 pl-11">
          {displayed.length > 0 ? (
            displayed.map(t => <ThreadTile key={t.id} thread={t} compact />)
          ) : (
            <p className="text-[13px] text-zinc-400 italic">No items currently in this section.</p>
          )}
          
          {hasMore && (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSection(id); }}
              className="mt-2 text-[11px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              {isExpanded ? 'Show Less' : `Show all ${threads.length} items`}
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] dark:bg-zinc-950">
      <div className="px-8 py-10 border-b border-zinc-100 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[850px] mx-auto w-full">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86868B] dark:text-zinc-500 uppercase tracking-widest mb-2">
            <span>Dashboard</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black dark:text-zinc-300">Focus Action View</span>
          </div>
          <h1 className="text-[32px] font-bold text-[#1D1D1F] dark:text-zinc-100 tracking-tight">Today's Focus</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-12">
        <div className="max-w-[850px] mx-auto w-full">
          <div className="mb-10 rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-6 py-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[#86868B] dark:text-zinc-400">
                  Primary Inbox · {syncMeta?.range ?? state.dateRange}
                </p>
                {state.isSyncing ? (
                  <p className="mt-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                    Loading more…
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-[#424245] dark:text-zinc-300">
                    {syncMeta
                      ? `Loaded ${syncMeta.totalFetched} threads across ${syncMeta.pages} page${syncMeta.pages === 1 ? '' : 's'} (${syncMeta.rangeDays} day window)`
                      : 'Run a sync to pull Primary inbox threads'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6 text-[12px] font-semibold text-[#424245] dark:text-zinc-200">
                <span>{actionableCount} actionable</span>
                <span>{totalThreads} total</span>
                <span>Last sync {state.lastSyncTime}</span>
              </div>
            </div>
            {!state.isSyncing && syncMeta?.capped && (
              <p className="mt-3 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Showing the first {syncMeta.totalFetched} threads (cap reached). Narrow the range to pull fewer pages.
              </p>
            )}
          </div>

          {renderSection('do-now', 'Do Now', <Zap />, doNow, 'bg-red-500')}
          {renderSection('needs-reply', 'Needs Reply', <Inbox />, needsReply, 'bg-blue-500')}
          {renderSection('follow-ups', 'Follow-Ups', <Bell />, followUps, 'bg-amber-500')}
        </div>
      </div>
    </div>
  );
};
