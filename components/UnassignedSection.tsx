
import React from 'react';
import { Thread, Bucket } from '../types';
import { useAppState } from '../store';
import { Archive, XCircle, Tag, Sparkles } from 'lucide-react';
import { suggestBucketHeuristic } from '../utils';

export const UnassignedSection: React.FC<{ threads: Thread[] }> = ({ threads }) => {
  const { state, dispatch } = useAppState();

  if (threads.length === 0) return null;

  const handleRoute = (e: React.MouseEvent, id: string, bucket: Bucket) => {
    e.stopPropagation();
    dispatch({ type: 'MOVE_THREAD', payload: { id, bucket } });
  };

  return (
    <section className="bg-amber-50/30 dark:bg-amber-900/5 rounded-[32px] p-8 border border-amber-100/30 dark:border-amber-900/20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[18px] font-bold text-amber-900 dark:text-amber-500 tracking-tight">Unassigned Intake</h2>
          <p className="text-[13px] text-amber-800/60 dark:text-amber-500/60 font-medium">Click to preview and classify incoming work.</p>
        </div>
        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm">
          {threads.length} PENDING
        </span>
      </div>

      <div className="space-y-4">
        {threads.map(t => {
          const suggestion = suggestBucketHeuristic(t);
          const isSelected = state.selectedThreadId === t.id;

          return (
            <div 
              key={t.id} 
              onClick={() => dispatch({ type: 'SELECT_THREAD', payload: t.id })}
              className={`bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md cursor-pointer ${
                isSelected ? 'ring-2 ring-amber-500 border-transparent bg-white' : 'border-amber-100/40 dark:border-amber-900/20'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-zinc-100">{t.fromName || 'Unknown Sender'}</span>
                  <span className="text-[11px] font-medium text-[#86868B] dark:text-zinc-500 truncate max-w-[180px]">{t.fromEmail}</span>
                  {t.contextTag && (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-500 bg-amber-100/50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded ml-1">
                      <Tag className="w-2.5 h-2.5" />
                      {t.contextTag}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[14px] font-bold text-[#1D1D1F] dark:text-zinc-100 truncate">{t.subject}</p>
                  {suggestion && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                      Suggest: {suggestion.bucket.split(' ')[0]}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#86868B] dark:text-zinc-400 line-clamp-1 italic">"{t.snippet}"</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <button
                  onClick={(e) => handleRoute(e, t.id, Bucket.SALES)}
                  className="text-[11px] font-bold px-4 py-2 bg-[#F5F5F7] dark:bg-zinc-700 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 rounded-xl transition-all dark:text-zinc-200"
                >
                  Sales
                </button>
                <button
                  onClick={(e) => handleRoute(e, t.id, Bucket.PROJECTS)}
                  className="text-[11px] font-bold px-4 py-2 bg-[#F5F5F7] dark:bg-zinc-700 hover:bg-green-600 hover:text-white dark:hover:bg-green-600 rounded-xl transition-all dark:text-zinc-200"
                >
                  Active
                </button>
                <button
                  onClick={(e) => handleRoute(e, t.id, Bucket.INTERNAL)}
                  className="text-[11px] font-bold px-4 py-2 bg-[#F5F5F7] dark:bg-zinc-700 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 rounded-xl transition-all dark:text-zinc-200"
                >
                  Internal
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1" />
                <button
                  onClick={(e) => handleRoute(e, t.id, Bucket.CLEARED)}
                  className="p-2 bg-[#F5F5F7] dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-xl transition-all text-gray-500 dark:text-zinc-400"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
