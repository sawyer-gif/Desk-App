
import React from 'react';
import { Thread, ProjectStatus } from '../types';
import { useAppState } from '../store';
import { Sparkles, AlertCircle, Bell, Pin, AtSign } from 'lucide-react';
import { formatReceivedTime, computeWaitingText, getWaitingColorClass, detectSawyerQuestions } from '../utils';

interface ThreadTileProps {
  thread: Thread;
  compact?: boolean;
}

const statusColorMap: Record<ProjectStatus, string> = {
  'Installation': 'bg-blue-100/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Shipping': 'bg-green-100/60 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'Support': 'bg-amber-100/60 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Change Order': 'bg-purple-100/60 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

export const ThreadTile: React.FC<ThreadTileProps> = ({ thread, compact = false }) => {
  const { state, dispatch } = useAppState();
  const isSelected = state.selectedThreadId === thread.id;

  const receivedTime = formatReceivedTime(thread.lastInboundAt);
  const waitingText = computeWaitingText(thread.daysUnresponded, thread.awaitingSawyerReply);
  const waitingColor = getWaitingColorClass(thread.daysUnresponded, thread.awaitingSawyerReply);
  const isOverdue = thread.awaitingSawyerReply && thread.daysUnresponded >= 4;

  const priorityColor = thread.priority === 'High' ? 'bg-red-500' : thread.priority === 'Normal' ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-100 dark:bg-zinc-800';

  // Questions logic
  const questions = detectSawyerQuestions(thread.messages);
  const openQuestionsCount = questions.filter(q => !(thread.answeredQuestionIds || []).includes(q.id)).length;

  return (
    <div 
      onClick={() => dispatch({ type: 'SELECT_THREAD', payload: thread.id })}
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
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1A6] dark:text-zinc-500 shrink-0">
              {thread.contextTag}
            </span>
            <span className="text-[13px] font-bold text-[#424245] dark:text-zinc-300 truncate">
              {thread.project}
            </span>
            {thread.projectStatus && (
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0 ${statusColorMap[thread.projectStatus]}`}>
                {thread.projectStatus}
              </span>
            )}
          </div>
          <p className={`text-[14px] truncate ${thread.unread ? 'font-semibold text-[#1D1D1F] dark:text-zinc-100' : 'text-[#86868B] dark:text-zinc-500'}`}>
            {thread.actionPhrase || thread.subject}
          </p>
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
              >
                <Sparkles className="w-3.5 h-3.5" />
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
