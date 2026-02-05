
import React, { useState } from 'react';
import { useAppState } from '../store';
import { Bucket, Thread } from '../types';
import { ThreadTile } from './ThreadTile';
import { ChevronRight, Clock, AlertCircle, Inbox, CheckCircle2 } from 'lucide-react';

export const BucketFocusedView: React.FC<{ bucket: Bucket }> = ({ bucket }) => {
  const { state } = useAppState();
  const [tab, setTab] = useState<'ALL' | 'REPLY' | 'OVERDUE' | 'WAITING'>('ALL');

  const allThreadsInBucket = state.threads.filter(t => t.bucket === bucket);
  
  const searchFiltered = allThreadsInBucket.filter(t => 
    t.subject.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
    t.fromName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    t.project.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  const filteredThreads = searchFiltered.filter(t => {
    if (tab === 'REPLY') return t.awaitingSawyerReply;
    if (tab === 'OVERDUE') return (t.awaitingSawyerReply && t.daysUnresponded >= 4) || (t.followUpAt && new Date(t.followUpAt) < new Date());
    if (tab === 'WAITING') return !t.awaitingSawyerReply || t.followUpAt !== null;
    return true;
  });

  const counts = {
    ALL: allThreadsInBucket.length,
    REPLY: allThreadsInBucket.filter(t => t.awaitingSawyerReply).length,
    OVERDUE: allThreadsInBucket.filter(t => (t.awaitingSawyerReply && t.daysUnresponded >= 4) || (t.followUpAt && new Date(t.followUpAt) < new Date())).length,
    WAITING: allThreadsInBucket.filter(t => !t.awaitingSawyerReply || t.followUpAt !== null).length,
  };

  return (
    <div className="flex-1 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 bg-[#FAF9F6] dark:bg-zinc-950">
      <div className="px-8 py-10 border-b border-gray-100 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[850px] mx-auto w-full">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86868B] dark:text-zinc-500 uppercase tracking-widest mb-2">
            <span>Dashboard</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black dark:text-zinc-300">{bucket}</span>
          </div>
          <h1 className="text-[32px] font-bold text-[#1D1D1F] dark:text-zinc-100 tracking-tight mb-6">{bucket}</h1>
          
          <div className="flex gap-1 bg-[#E8E8ED]/50 dark:bg-zinc-800/80 p-1 rounded-2xl w-fit">
            {(['ALL', 'REPLY', 'OVERDUE', 'WAITING'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 ${
                  tab === t 
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-zinc-100' 
                    : 'text-[#86868B] hover:text-[#424245] dark:hover:text-zinc-400'
                }`}
              >
                {t === 'REPLY' && <Clock className="w-3.5 h-3.5" />}
                {t === 'OVERDUE' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                {t === 'ALL' && <Inbox className="w-3.5 h-3.5" />}
                {t === 'WAITING' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                {t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${tab === t ? 'bg-gray-100 dark:bg-zinc-600 text-gray-600 dark:text-zinc-200' : 'bg-transparent text-gray-400'}`}>
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="max-w-[850px] mx-auto w-full space-y-2">
          {filteredThreads.length > 0 ? (
            filteredThreads.map(t => <ThreadTile key={t.id} thread={t} />)
          ) : (
            <div className="py-20 text-center bg-white/20 dark:bg-zinc-900/10 rounded-[32px] border border-dashed border-gray-200 dark:border-zinc-800">
              <p className="text-[15px] font-medium text-[#A1A1A6] dark:text-zinc-600">No threads match this filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
