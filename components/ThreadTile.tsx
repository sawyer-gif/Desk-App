import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Thread, Bucket } from '../types';
import { useAppState } from '../store';
import { Sparkles, AlertCircle, Bell, Pin, AtSign, EyeOff, Eye } from 'lucide-react';
import { formatReceivedTime, computeWaitingText, getWaitingColorClass, detectSawyerQuestions, getWaitingStatus } from '../utils';

interface ThreadTileProps {
  thread: Thread;
  compact?: boolean;
}

export const ThreadTile: React.FC<ThreadTileProps> = ({ thread, compact = false }) => {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const isSelected = state.selectedThreadId === thread.id;

  const receivedTime = formatReceivedTime(thread.lastInboundAt);
  const { waitingDays, showWaiting, isOverdue } = getWaitingStatus(thread);
  const isMuted = Boolean(thread.isMuted);
  const isSuppressed = thread.isActionable === false;
  const suppressionLabel = isMuted ? 'Muted' : isSuppressed ? 'Filtered' : null;
  const waitingText = computeWaitingText(waitingDays, showWaiting);
  const waitingColor = getWaitingColorClass(waitingDays, showWaiting);

  const priorityColor = thread.priority === 'High' ? 'bg-red-500' : thread.priority === 'Normal' ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-100 dark:bg-zinc-800';

  // Questions logic
  // Guard: avoid crashes if API returns missing/invalid arrays
const messages = Array.isArray((thread as any).messages) ? (thread as any).messages : [];
const questions = (detectSawyerQuestions(messages) || []);
const answeredIds = Array.isArray((thread as any).answeredQuestionIds) ? (thread as any).answeredQuestionIds : [];
const openQuestionsCount = questions.filter(q => !answeredIds.includes(q.id)).length;


  const handleNavigate = () => {
    dispatch({ type: 'SELECT_THREAD', payload: thread.id });
    navigate(`/threads/${thread.id}`);
    if (import.meta.env?.DEV) {
      console.log('[Desk] Navigating to thread detail', thread.id);
    }
  };

  return (
    <div 
      onClick={handleNavigate}
      className={`group flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer border ${
        isSelected 
          ? 'bg-white dark:bg-zinc-800 border-black dark:border-zinc-600 shadow-sm ring-1 ring-black/5' 
          : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="flex items-center shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${priorityColor}`} title={`Priority: ${thread.priority}`} />
          {thread.pinned && <Pin className="w-3 h-3 text-blue-500 ml-1.5 fill-current" />}
          {thread.unread && <span className="w-2 h-2 rounded-full bg-blue-500 ml-1.5" />}
          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-[#FF3B30] ml-1.5" />}
          {thread.followUpAt && <Bell className="w-3 h-3 text-amber-500 ml-1.5" />}
          {openQuestionsCount > 0 && (
            <div className="ml-1.5 flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
              <AtSign className="w-2.5 h-2.5" />
              {openQuestionsCount}
            </div>
          )}
        </div>
        
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-zinc-100 truncate">
              {thread.fromName || thread.fromEmail}
            </span>
            {thread.fromCompany && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] dark:text-zinc-400">
                {thread.fromCompany}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1A6] dark:text-zinc-500 shrink-0">
              {thread.contextTag}
            </span>
            {suppressionLabel && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {suppressionLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1 text-[11px] text-[#86868B] dark:text-zinc-500 truncate">
            <span className="truncate">{thread.fromEmail}</span>
            {thread.fromDomain && <span className="text-[#C6C6C8] dark:text-zinc-600">• {thread.fromDomain}</span>}
          </div>
          <p className={`text-[14px] truncate ${thread.unread ? 'font-semibold text-[#1D1D1F] dark:text-zinc-100' : 'text-[#86868B] dark:text-zinc-500'}`}>
            {thread.subject}
          </p>
          {thread.snippet && (
            <p className="text-[12px] text-[#A1A1A6] dark:text-zinc-500 truncate">
              {thread.snippet}
            </p>
          )}
          {suppressionLabel && thread.nonActionableReason && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 truncate">
              Hidden: {thread.nonActionableReason}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 pl-6 gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#A1A1A6] dark:text-zinc-500 uppercase">{receivedTime}</span>
          {!compact && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'SELECT_THREAD', payload: thread.id });
                  dispatch({ type: 'TOGGLE_DRAFT_MODAL', payload: true });
                }}
                className="p-1 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 rounded-lg text-[#86868B]"
                title="Open AI draft"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'TOGGLE_THREAD_MUTE', payload: { threadId: thread.id } });
                }}
                className="p-1 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 rounded-lg text-[#86868B]"
                title={isMuted ? 'Unmute thread' : 'Mute as not actionable'}
              >
                {isMuted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
        {waitingText && (
          <span className={`text-[10px] uppercase tracking-wide font-bold ${waitingColor}`}>
            {waitingText}
          </span>
        )}
      </div>
    </div>
  );
};
