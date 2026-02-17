import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '../store';
import { Bucket, Priority } from '../types';
import { Badge, PriorityBadge } from './Badge';
import { X, ExternalLink, MessageSquare, History, ChevronDown, Pin, AtSign, CheckCircle2, ChevronUp } from 'lucide-react';
import { formatReceivedTime, detectSawyerQuestions, getThreadSummary } from '../utils';
import { useAuth } from '@clerk/clerk-react';
import DOMPurify from 'dompurify';

const CATEGORY_DEFINITIONS: Record<string, string> = {
  Sales: "Pre-commitment: leads, quotes, proposals, bids, samples, renderings.",
  'Active Projects': "Post-commitment: approvals, shop drawings, schedule, install, shipping.",
  Internal: "Team ops: production, accounting, vendor coordination, internal planning."
};

const LoadingSkeleton: React.FC = () => (
  <div className="w-[520px] border-l border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 h-full flex flex-col animate-pulse p-8">
    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-2/3 mb-4" />
    <div className="space-y-3">
      {[...Array(5)].map((_, idx) => (
        <div key={idx} className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
      ))}
    </div>
  </div>
);

const MissingThreadState: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="w-[520px] border-l border-black/5 dark:border-white/5 bg-desk-surface-light dark:bg-desk-surface-dark h-full flex flex-col items-center justify-center text-center p-10">
    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500 mb-3">Thread not found</p>
    <h2 className="text-2xl font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark mb-4">This link doesn&apos;t exist anymore</h2>
    <p className="text-sm text-desk-text-secondary-light dark:text-desk-text-secondary-dark mb-8 max-w-xs">
      The thread may have been archived or hasn&apos;t synced down yet. Head back to the Focus list and pick another thread.
    </p>
    <button onClick={onBack} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold dark:bg-white dark:text-black">
      Back to Focus View
    </button>
  </div>
);

export const DetailPanel: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const threads = Array.isArray(state.threads) ? state.threads : [];
  const thread = state.selectedThreadId ? threads.find(t => t.id === state.selectedThreadId) : null;
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [showPriorityOptions, setShowPriorityOptions] = useState(false);
  const [alwaysRoute, setAlwaysRoute] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [rawThreadData, setRawThreadData] = useState<Record<string, any>>({});
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function fetchThreadDetail(currentThreadId: string) {
      try {
        setThreadError(null);
        setLoadingThreadId(currentThreadId);
        const authToken = (await getToken?.()) || '';
        if (!authToken) {
          throw new Error('Missing auth token');
        }
        const response = await fetch(`/api/google/gmail-thread-detail?threadId=${encodeURIComponent(currentThreadId)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || 'Failed to load thread');
        }
        if (!cancelled) {
          setRawThreadData(prev => ({ ...prev, [currentThreadId]: json }));
        }
      } catch (err: any) {
        if (!cancelled) {
          setThreadError(err?.message || 'Failed to load thread');
        }
      } finally {
        if (!cancelled) {
          setLoadingThreadId(prev => (prev === currentThreadId ? null : prev));
        }
      }
    }

    if (thread?.id && !rawThreadData[thread.id]) {
      fetchThreadDetail(thread.id);
    }

    return () => {
      cancelled = true;
    };
  }, [thread?.id, rawThreadData, getToken]);

  const timelineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleClosePanel = () => {
    dispatch({ type: 'SELECT_THREAD', payload: null });
    if (threadId) {
      navigate('/', { replace: true });
    }
  };

  if (!threadId && !thread) {
    return null;
  }

  if (threadId && !thread && state.isSyncing) {
    return <LoadingSkeleton />;
  }

  if (threadId && !thread) {
    return <MissingThreadState onBack={handleClosePanel} />;
  }

  if (!thread) {
    return null;
  }

  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const currentThreadData = thread ? rawThreadData[thread.id] : null;
  const isLoadingThread = loadingThreadId === thread.id;
  const hasMessages = messages.length > 0;
  const answeredIds = Array.isArray(thread.answeredQuestionIds) ? thread.answeredQuestionIds : [];
  const questions = detectSawyerQuestions(messages) || [];
  const openQuestions = questions.filter(q => !answeredIds.includes(q.id));

  const gmailMessages = Array.isArray(currentThreadData?.messages) ? currentThreadData.messages : [];
  const latestMessage = gmailMessages[gmailMessages.length - 1];
  const htmlBody = (latestMessage?.htmlBody || '').trim();
  const textBody = (latestMessage?.textBody || '').trim();
  const sanitizedHtml = htmlBody ? DOMPurify.sanitize(htmlBody) : '';
  const attachments = Array.isArray(latestMessage?.attachments) ? latestMessage.attachments : [];

  const handleRoute = (bucket: Bucket) => {
    dispatch({ type: 'MOVE_THREAD', payload: { id: thread.id, bucket, applyRule: alwaysRoute } });
    setShowMoveOptions(false);
  };

  const handlePriority = (priority: Priority) => {
    dispatch({ type: 'SET_PRIORITY', payload: { id: thread.id, priority } });
    setShowPriorityOptions(false);
  };

  const handleJumpTo = (id: string) => {
    setTimelineExpanded(true);
    setTimeout(() => {
      timelineRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const isUnassigned = thread.bucket === Bucket.UNASSIGNED;

  return (
    <div className="w-[520px] border-l border-black/5 dark:border-white/5 bg-desk-surface-light dark:bg-desk-surface-dark h-full flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.015)] animate-in slide-in-from-right duration-500 z-40 transition-colors duration-500">
      <div className="p-6 pb-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_PIN', payload: thread.id })}
            className={`p-1.5 rounded-lg transition-colors ${thread.pinned ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-desk-text-secondary-light/40 hover:text-desk-text-primary-light'}`}
          >
            <Pin className={`w-4 h-4 ${thread.pinned ? 'fill-current' : ''}`} />
          </button>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-desk-text-secondary-light dark:text-desk-text-secondary-dark mb-1">Thread Insight</h2>
            <p className="text-[13px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark">{thread.project}</p>
          </div>
        </div>
        <button 
          onClick={handleClosePanel}
          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-desk-text-secondary-light dark:text-desk-text-secondary-dark" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
        
        {/* Thread Summary */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <button onClick={() => setShowPriorityOptions(!showPriorityOptions)}>
                <PriorityBadge priority={thread.priority} />
              </button>
              {showPriorityOptions && (
                <div className="absolute top-8 left-0 z-50 bg-desk-surface-light dark:bg-desk-surface-dark border border-black/5 dark:border-white/10 shadow-2xl rounded-2xl p-2 w-32 flex flex-col gap-1">
                  {(['High', 'Normal', 'Low'] as Priority[]).map(p => (
                    <button key={p} onClick={() => handlePriority(p)} className="text-left px-3 py-2 text-[12px] font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 dark:text-desk-text-primary-dark">
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Badge variant={thread.bucket === Bucket.PROJECTS ? 'green' : thread.bucket === Bucket.SALES ? 'blue' : 'default'}>
              {thread.bucket}
            </Badge>
          </div>
          <h1 className="text-xl font-bold leading-tight mb-4 text-desk-text-primary-light dark:text-desk-text-primary-dark">{thread.subject}</h1>
          <p className="text-[14px] text-desk-text-secondary-light dark:text-desk-text-secondary-dark leading-relaxed font-medium">
            {getThreadSummary(thread)}
          </p>
        </section>

        {/* Questions for Sawyer */}
        {questions.length > 0 && (
          <section className="bg-blue-500/5 dark:bg-blue-400/5 rounded-[24px] p-6 border border-blue-500/10 dark:border-blue-400/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-[12px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Questions for Sawyer</h3>
              </div>
              <span className="text-[10px] font-bold bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                {openQuestions.length} Open
              </span>
            </div>
            <div className="space-y-3">
              {questions.map(q => {
                const isAnswered = (thread.answeredQuestionIds || []).includes(q.id);
                return (
                  <div key={q.id} className={`p-4 rounded-xl border transition-all ${isAnswered ? 'bg-black/5 dark:bg-white/5 border-transparent opacity-60' : 'bg-desk-surface-light dark:bg-white/5 border-blue-500/10 dark:border-blue-400/10'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className={`text-[13px] font-bold mb-1 ${isAnswered ? 'text-desk-text-secondary-light line-through' : 'text-desk-text-primary-light dark:text-desk-text-primary-dark'}`}>
                          {q.content.split('?')[0]}?
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-desk-text-secondary-light/60 dark:text-desk-text-secondary-dark/60">
                          <span className="font-bold">{q.sender}</span>
                          <span>•</span>
                          <span>{formatReceivedTime(q.timestamp)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => handleJumpTo(q.id)}
                          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-desk-text-secondary-light/40"
                          title="Jump to message"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => dispatch({ type: 'TOGGLE_QUESTION_ANSWERED', payload: { threadId: thread.id, messageId: q.id } })}
                          className={`p-2 rounded-lg transition-colors ${isAnswered ? 'text-green-500 bg-green-500/10' : 'text-desk-text-secondary-light/20 hover:text-green-500 hover:bg-green-500/10'}`}
                          title="Mark Answered"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Gmail Body Preview */}
        <section className="rounded-2xl border border-desk-text-secondary-light/20 dark:border-desk-text-secondary-dark/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.35em] text-desk-text-secondary-light dark:text-desk-text-secondary-dark">Gmail Body</h3>
              <p className="text-[11px] text-desk-text-secondary-light/80 dark:text-desk-text-secondary-dark/80">Latest message pulled live</p>
            </div>
            {isLoadingThread && <span className="text-[10px] text-blue-500 font-bold">Loading…</span>}
          </div>

          {threadError && (
            <p className="text-xs text-red-500 font-semibold">{threadError}</p>
          )}
          {!threadError && !currentThreadData && !isLoadingThread && (
            <p className="text-xs text-desk-text-secondary-light dark:text-desk-text-secondary-dark">Select a thread to load Gmail data.</p>
          )}

          {currentThreadData && (
            <>
              <div className="min-h-[160px] rounded-xl border border-desk-text-secondary-light/10 dark:border-desk-text-secondary-dark/20 bg-black/5 dark:bg-white/5 p-4 overflow-auto">
                {sanitizedHtml ? (
                  <div className="prose prose-sm max-w-none text-desk-text-secondary-light dark:text-desk-text-secondary-dark" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                ) : textBody ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-desk-text-secondary-light dark:text-desk-text-secondary-dark">{textBody}</p>
                ) : (
                  <p className="text-xs text-desk-text-secondary-light/70 dark:text-desk-text-secondary-dark/70">No body content available yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.35em] text-desk-text-secondary-light dark:text-desk-text-secondary-dark">Attachments</h4>
                {attachments.length ? (
                  <ul className="text-sm text-desk-text-secondary-light dark:text-desk-text-secondary-dark space-y-1">
                    {attachments.map((attachment, idx) => (
                      <li key={attachment.attachmentId || `${attachment.filename}-${idx}`} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500/50" />
                        <span>{attachment.filename || 'attachment'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-desk-text-secondary-light/70 dark:text-desk-text-secondary-dark/70">No attachments for this message.</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Conversation Timeline */}
        <section>
          <div 
            onClick={() => setTimelineExpanded(!timelineExpanded)}
            className="flex items-center justify-between cursor-pointer group mb-6"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-desk-text-secondary-light/60" />
              <h3 className="text-[11px] font-bold text-desk-text-secondary-light dark:text-desk-text-secondary-dark uppercase tracking-widest">Conversation Timeline</h3>
            </div>
            <div className="text-desk-text-secondary-light/40 group-hover:text-desk-text-primary-light transition-colors">
              {timelineExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
          
          <div className={`space-y-8 transition-all duration-300 overflow-hidden ${timelineExpanded ? 'max-h-[5000px]' : 'max-h-[220px] relative'}`}>
            {hasMessages ? (
              messages.map((msg) => {
                const isMe = msg.sender.toLowerCase().includes('you');
  
                return (
                  <div 
                    key={msg.id} 
                    ref={el => { timelineRefs.current[msg.id] = el; }}
                    className="relative pl-8 border-l border-black/5 dark:border-white/5"
                  >
                    <div className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-desk-surface-light dark:border-surface-dark ${isMe ? 'bg-blue-500' : 'bg-desk-text-secondary-light/20'}`} />
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={`text-[12px] font-bold ${isMe ? 'text-blue-600 dark:text-blue-400' : 'text-desk-text-primary-light dark:text-desk-text-primary-dark'}`}>
                        {msg.sender}
                      </p>
                      <p className="text-[10px] text-desk-text-secondary-light/40 dark:text-desk-text-secondary-dark/40 font-bold uppercase">
                        {formatReceivedTime(msg.timestamp)}
                      </p>
                    </div>
                    <p className="text-[14px] text-desk-text-secondary-light dark:text-desk-text-secondary-dark leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-desk-text-secondary-light/20 dark:border-desk-text-secondary-dark/30 p-6 text-center">
                <p className="text-sm font-semibold text-desk-text-primary-light dark:text-desk-text-primary-dark mb-2">
                  No messages yet
                </p>
                <p className="text-xs text-desk-text-secondary-light dark:text-desk-text-secondary-dark">
                  We haven&apos;t synced any messages for this thread. Try refreshing or syncing from Gmail.
                </p>
              </div>
            )}
            
            {!timelineExpanded && hasMessages && messages.length > 2 && (
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-desk-surface-light dark:from-desk-surface-dark to-transparent flex items-end justify-center pb-2">
                <button 
                  onClick={() => setTimelineExpanded(true)}
                  className="text-[11px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-600 bg-desk-surface-light dark:bg-desk-surface-dark px-4 py-2 rounded-full border border-blue-500/10 shadow-sm"
                >
                  Show full history ({messages.length} messages)
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="p-8 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] space-y-4">
        {isUnassigned && (
          <div className="flex items-center gap-2 px-1">
            <input 
              type="checkbox" 
              id="always-route" 
              checked={alwaysRoute}
              onChange={(e) => setAlwaysRoute(e.target.checked)}
              className="w-4 h-4 rounded border-black/10 text-blue-600 focus:ring-blue-500" 
            />
            <label htmlFor="always-route" className="text-[12px] font-medium text-desk-text-secondary-light dark:text-desk-text-secondary-dark cursor-pointer">
              Always route messages from this sender
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isUnassigned ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleRoute(Bucket.SALES)} className="bg-blue-600 text-white py-2.5 rounded-xl text-[12px] font-bold hover:bg-blue-700 transition-colors">Sales</button>
              <button onClick={() => handleRoute(Bucket.PROJECTS)} className="bg-green-600 text-white py-2.5 rounded-xl text-[12px] font-bold hover:bg-green-700 transition-colors">Active</button>
              <button onClick={() => handleRoute(Bucket.INTERNAL)} className="bg-black/5 dark:bg-white/5 text-desk-text-primary-light dark:text-desk-text-primary-dark py-2.5 rounded-xl text-[12px] font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Internal</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowMoveOptions(!showMoveOptions)}
                className="flex-1 flex items-center justify-between bg-desk-surface-light dark:bg-white/5 border border-black/5 dark:border-white/5 py-3 px-5 rounded-xl text-[13px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark hover:bg-black/5 dark:hover:bg-white/10 transition-all relative"
              >
                <span>Move to...</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showMoveOptions ? 'rotate-180' : ''}`} />
                {showMoveOptions && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-desk-surface-light dark:bg-desk-surface-dark border border-black/5 dark:border-white/10 shadow-2xl rounded-2xl p-2 flex flex-col gap-1">
                    {[Bucket.SALES, Bucket.PROJECTS, Bucket.INTERNAL, Bucket.CLEARED].filter(b => b !== thread.bucket).map(b => (
                      <button key={b} onClick={() => handleRoute(b)} className="text-left px-3 py-2 text-[12px] font-medium rounded-lg hover:bg-black/5 dark:hover:bg-white/5 dark:text-desk-text-primary-dark">
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </button>
              <button className="flex items-center justify-center gap-2 bg-desk-surface-light dark:bg-white/5 border border-black/5 dark:border-white/5 py-3 px-5 rounded-xl text-[13px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
                <ExternalLink className="w-4 h-4" />
                Gmail
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
