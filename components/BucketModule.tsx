
import React from 'react';
import { Thread, Bucket } from '../types';
import { useAppState } from '../store';
import { ThreadTile } from './ThreadTile';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const BucketModule: React.FC<{ bucket: Bucket; threads: Thread[] }> = ({ bucket, threads }) => {
  const { state, dispatch } = useAppState();
  const isExpanded = state.expandedBuckets.has(bucket);
  const visibleThreads = isExpanded ? threads : threads.slice(0, 3);

  const waitingThreads = threads.filter(t => t.awaitingSawyerReply);
  const oldestWaiting = waitingThreads.length > 0 
    ? Math.max(...waitingThreads.map(t => t.daysUnresponded)) 
    : null;

  return (
    <div className="bg-[#E8E8ED]/30 rounded-[28px] overflow-hidden transition-all pb-2">
      <div 
        onClick={() => dispatch({ type: 'TOGGLE_BUCKET_EXPAND', payload: bucket })}
        className="px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-gray-200/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-bold text-[#424245]">{bucket}</h3>
          <span className="text-[11px] font-bold text-[#86868B] bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
            {threads.length}
          </span>
          {oldestWaiting !== null && (
            <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider pl-2 opacity-60">
              Oldest: {oldestWaiting}d
            </span>
          )}
        </div>
        <div className="text-gray-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      <div className="px-3 pb-2 space-y-1">
        {visibleThreads.length > 0 ? (
          visibleThreads.map(t => (
            <ThreadTile key={t.id} thread={t} compact />
          ))
        ) : (
          <p className="text-[12px] text-gray-300 italic px-4 py-3">All clear</p>
        )}
        
        {threads.length > 3 && !isExpanded && (
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_BUCKET_EXPAND', payload: bucket })}
            className="w-full py-3 text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors"
          >
            Show {threads.length - 3} more
          </button>
        )}
      </div>
    </div>
  );
};
