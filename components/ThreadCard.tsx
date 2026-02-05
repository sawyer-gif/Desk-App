
import React from 'react';
import { Thread, Bucket } from '../types';
import { useAppState } from '../store';
import { PriorityBadge } from './Badge';
import { MailOpen, Archive, Clock, Sparkles } from 'lucide-react';

export const ThreadCard: React.FC<{ thread: Thread }> = ({ thread }) => {
  const { state, dispatch } = useAppState();
  const isSelected = state.selectedThreadId === thread.id;

  const handleMove = (e: React.MouseEvent, bucket: Bucket) => {
    e.stopPropagation();
    dispatch({ type: 'MOVE_THREAD', payload: { id: thread.id, bucket } });
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'ARCHIVE_THREAD', payload: thread.id });
  };

  // Fix: changed 'lastMessageAt' to 'lastInboundAt' to match the Thread type
  const formattedDate = new Date(thread.lastInboundAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      onClick={() => dispatch({ type: 'SELECT_THREAD', payload: thread.id })}
      className={`apple-card group relative p-4 cursor-pointer mb-3 select-none ${
        isSelected ? 'ring-2 ring-black bg-white scale-[1.02] shadow-xl' : ''
      }`}
    >
      {thread.unread && (
        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <PriorityBadge priority={thread.priority} />
          <span className="text-[10px] text-[#86868B] font-medium uppercase">{formattedDate}</span>
        </div>

        <div className="space-y-0.5">
          <h4 className={`text-[14px] font-semibold truncate ${thread.unread ? 'text-black' : 'text-[#424245]'}`}>
            {thread.fromName}
          </h4>
          <h5 className={`text-[13px] font-medium leading-tight line-clamp-1 ${thread.unread ? 'text-black' : 'text-[#424245]'}`}>
            {thread.subject}
          </h5>
        </div>

        <p className="text-[12px] text-[#86868B] line-clamp-2 leading-relaxed">
          {thread.snippet}
        </p>

        <div className="flex flex-wrap gap-1 mt-1">
          {thread.labels.map(label => (
            <span key={label} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {label}
            </span>
          ))}
        </div>

        {/* Quick Actions overlay on hover */}
        <div className="opacity-0 group-hover:opacity-100 absolute bottom-3 right-3 flex items-center gap-1 transition-opacity duration-200 bg-white/90 backdrop-blur p-1 rounded-xl border border-gray-100 shadow-sm">
           <button 
            title="AI Draft"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_THREAD', payload: thread.id }); dispatch({ type: 'TOGGLE_DRAFT_MODAL', payload: true }); }}
            className="p-1.5 hover:bg-black hover:text-white rounded-lg transition-colors text-gray-500"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button 
            title="Mark Waiting"
            onClick={(e) => handleMove(e, Bucket.WAITING)}
            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-gray-500"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button 
            title="Archive"
            onClick={handleArchive}
            className="p-1.5 hover:bg-gray-100 hover:text-black rounded-lg transition-colors text-gray-500"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
