
import React from 'react';
import { useAppState } from '../store';
import { X, Copy, CheckCircle2, Sparkles, Wand2 } from 'lucide-react';

export const DraftModal: React.FC = () => {
  const { state, dispatch } = useAppState();
  const thread = state.threads.find(t => t.id === state.selectedThreadId);

  if (!state.isDraftModalOpen || !thread) return null;

  const handleCopy = () => {
    if (thread.suggestedDraft) {
      navigator.clipboard.writeText(thread.suggestedDraft);
      alert('Copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-md"
        onClick={() => dispatch({ type: 'TOGGLE_DRAFT_MODAL', payload: false })}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl rounded-[32px] apple-shadow overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Suggested AI Reply</h2>
              <p className="text-[13px] text-[#86868B] font-medium">Generated based on your communication style</p>
            </div>
          </div>
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_DRAFT_MODAL', payload: false })}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-8 pt-4">
          <div className="bg-[#F5F5F7] p-8 rounded-[24px] border border-gray-100 min-h-[200px] mb-8 group relative">
            <p className="text-[16px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
              {thread.suggestedDraft || "Generating draft..."}
            </p>
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={handleCopy}
              className="flex-1 bg-black text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/90 active:scale-[0.98] transition-all shadow-xl shadow-black/10"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </button>
             <button 
              className="flex-1 border border-gray-200 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Save as Gmail Draft
            </button>
             <button 
              className="w-14 h-14 border border-gray-200 rounded-2xl flex items-center justify-center hover:bg-gray-50 transition-all"
              title="Re-generate"
            >
              <Wand2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
