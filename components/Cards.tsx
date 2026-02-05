
import React from 'react';
import { Thread, Bucket } from '../types';
import { useAppState } from '../store';
import { Sparkles, ArrowRight, MessageCircle, Clock } from 'lucide-react';
import { Badge } from './Badge';

export const AttentionCard: React.FC<{ thread: Thread }> = ({ thread }) => {
  const { dispatch } = useAppState();
  return (
    <div 
      onClick={() => dispatch({ type: 'SELECT_THREAD', payload: thread.id })}
      className="apple-card p-6 border-none shadow-xl shadow-black/[0.03] flex flex-col gap-4 cursor-pointer hover:scale-[1.01] transition-all relative overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {thread.reason && <Badge variant="red">{thread.reason}</Badge>}
          {thread.labels.map(l => <span key={l} className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{l}</span>)}
        </div>
        {/* Fix: changed 'lastMessageAt' to 'lastInboundAt' */}
        <span className="text-[11px] font-bold text-[#86868B] uppercase">{new Date(thread.lastInboundAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className="space-y-1">
        <p className="text-[14px] font-semibold text-[#86868B]">{thread.fromName}</p>
        <h3 className="text-xl font-bold text-[#1D1D1F] leading-tight">{thread.subject}</h3>
        <p className="text-[15px] text-[#424245] line-clamp-2 leading-relaxed mt-2">{thread.snippet}</p>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button 
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_THREAD', payload: thread.id }); dispatch({ type: 'TOGGLE_DRAFT_MODAL', payload: true }); }}
          className="bg-black text-white px-5 py-2.5 rounded-2xl text-[14px] font-bold flex items-center gap-2 hover:bg-black/80 transition-all shadow-lg shadow-black/5"
        >
          <Sparkles className="w-4 h-4" />
          Draft Reply
        </button>
        <div className="relative group">
          <select 
            onClick={e => e.stopPropagation()}
            onSelect={e => e.stopPropagation()}
            onChange={e => dispatch({ type: 'MOVE_THREAD', payload: { id: thread.id, bucket: e.target.value as Bucket } })}
            className="bg-gray-100 text-[#1D1D1F] px-5 py-2.5 rounded-2xl text-[14px] font-bold border-none appearance-none hover:bg-gray-200 transition-all cursor-pointer"
          >
            <option disabled selected>Move to...</option>
            {Object.values(Bucket).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

export const MotionCard: React.FC<{ thread: Thread }> = ({ thread }) => {
  const { dispatch } = useAppState();
  return (
    <div 
      onClick={() => dispatch({ type: 'SELECT_THREAD', payload: thread.id })}
      className="bg-white rounded-[20px] p-4 border border-black/[0.03] hover:border-black/[0.1] cursor-pointer transition-all group"
    >
      <div className="flex justify-between items-start mb-1">
        <p className="text-[12px] font-bold text-[#1D1D1F] truncate pr-4">{thread.fromName}</p>
        {/* Fix: changed 'lastMessageAt' to 'lastInboundAt' */}
        <span className="text-[10px] font-bold text-[#86868B] whitespace-nowrap">{new Date(thread.lastInboundAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
      </div>
      <p className="text-[13px] font-semibold text-[#424245] line-clamp-1 group-hover:text-black transition-colors">{thread.subject}</p>
      <p className="text-[12px] text-[#86868B] line-clamp-1 mt-1 font-medium">{thread.snippet}</p>
    </div>
  );
};

export const WaitingRow: React.FC<{ thread: Thread }> = ({ thread }) => {
  const { dispatch } = useAppState();
  return (
    <div 
      onClick={() => dispatch({ type: 'SELECT_THREAD', payload: thread.id })}
      className="flex items-center justify-between p-4 bg-[#FBFBFD] rounded-[20px] border border-transparent hover:border-gray-100 cursor-pointer group transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-200/50 flex items-center justify-center text-[#86868B]">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#1D1D1F]">{thread.fromName}</p>
          <p className="text-[12px] text-[#86868B] truncate max-w-md">{thread.subject}</p>
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 text-[12px] font-bold px-4 py-1.5 rounded-xl hover:bg-gray-50 active:scale-95">
        Nudge
      </button>
    </div>
  );
};
