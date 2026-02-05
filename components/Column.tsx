
import React from 'react';
import { Bucket, Thread } from '../types';
import { ThreadCard } from './ThreadCard';

interface ColumnProps {
  bucket: Bucket;
  threads: Thread[];
}

export const Column: React.FC<ColumnProps> = ({ bucket, threads }) => {
  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] h-full">
      <div className="px-1 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#1D1D1F]">{bucket}</h3>
          <span className="bg-[#E8E8ED] text-[#424245] px-2 py-0.5 rounded-full text-[11px] font-bold">
            {threads.length}
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-1 pb-10 scroll-smooth">
        {threads.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center">
            <p className="text-[12px] text-gray-400 font-medium">Clear for now</p>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))
        )}
      </div>
    </div>
  );
};
