
import React from 'react';
import { useAppState } from '../store';
import { Column } from './Column';
import { Bucket } from '../types';

export const KanbanBoard: React.FC = () => {
  const { state } = useAppState();

  const filteredThreads = state.threads.filter(t => {
    const matchesSearch = 
      t.subject.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      t.fromName.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <main className="flex-1 overflow-x-auto px-8 flex gap-6 mt-2">
      {Object.values(Bucket).map((bucket) => (
        <Column 
          key={bucket} 
          bucket={bucket} 
          threads={filteredThreads.filter(t => t.bucket === bucket)} 
        />
      ))}
    </main>
  );
};
