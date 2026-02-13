import React from 'react';

const formatTimestamp = (isoString?: string) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString(undefined, {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[Desk] Failed to format build timestamp', error);
    }
    return isoString;
  }
};

export const BuildStamp: React.FC = () => {
  if (typeof __BUILD_INFO__ === 'undefined') {
    return null;
  }

  const { commit, buildTime } = __BUILD_INFO__;
  const formatted = formatTimestamp(buildTime);

  return (
    <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-black/5 dark:border-white/10 shadow-sm">
      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        build <span className="font-semibold text-zinc-800 dark:text-zinc-200">{commit}</span>
      </p>
      {formatted && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          {formatted}
        </p>
      )}
    </div>
  );
};
