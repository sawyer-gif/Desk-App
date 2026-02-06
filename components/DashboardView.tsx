import React from 'react';
import { useAppState } from '../store';
import { Bucket, Thread } from '../types';
import { ArrowUpRight, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { UnassignedSection } from './UnassignedSection';
import { useAuth } from "@clerk/clerk-react";


export const DashboardView: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { getToken } = useAuth();


  const getMetrics = (bucketThreads: Thread[]) => {
    const awaiting = bucketThreads.filter(t => t.awaitingSawyerReply);
    const overdue = awaiting.filter(t => t.daysUnresponded >= 4);
    const oldest = awaiting.length > 0 ? Math.max(...awaiting.map(t => t.daysUnresponded)) : 0;
    return { count: bucketThreads.length, awaiting: awaiting.length, overdue: overdue.length, oldest };
  };

  const actionableThreads = state.threads.filter(t => t.awaitingSawyerReply && t.bucket !== Bucket.CLEARED && t.bucket !== Bucket.UNASSIGNED);
  const overdueCount = actionableThreads.filter(t => t.daysUnresponded >= 4).length;
  const oldestWaiting = actionableThreads.length > 0 ? Math.max(...actionableThreads.map(t => t.daysUnresponded)) : 0;

  const unassigned = state.threads.filter(t => t.bucket === Bucket.UNASSIGNED);

  const bucketList = [
    { name: Bucket.SALES, icon: 'bg-blue-500' },
    { name: Bucket.PROJECTS, icon: 'bg-green-500' },
    { name: Bucket.WAITING, icon: 'bg-amber-500' },
    { name: Bucket.INTERNAL, icon: 'bg-purple-500' },
    { name: Bucket.CLEARED, icon: 'bg-desk-text-secondary-light/50' },
  ];
      
  return (
    <div className="max-w-[1100px] w-full mx-auto px-8 py-12 space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Today at your Desk Summary */}
      <section>
        <div className="mb-6">
          <h2 className="text-[22px] font-bold text-desk-text-primary-light/80 dark:text-desk-text-primary-dark/80 tracking-tight">Today at your Desk</h2>
        </div>
        <div 
          onClick={() => dispatch({ type: 'NAVIGATE', payload: { type: 'FOCUS' } })}
          className="bg-desk-surface-light dark:bg-desk-surface-dark rounded-[32px] p-8 shadow-sm border border-black/5 dark:border-white/5 flex items-center justify-between cursor-pointer group hover:scale-[1.005] transition-all"
        >
          <div className="flex items-center gap-10">
            <div className="flex flex-col">
              <span className="text-[48px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark tracking-tighter leading-none">{actionableThreads.length}</span>
              <span className="text-[12px] font-bold text-desk-text-secondary-light dark:text-desk-text-secondary-dark uppercase tracking-widest mt-2">Actionable Items</span>
            </div>
            <div className="w-px h-12 bg-black/5 dark:bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[28px] font-bold text-red-500 dark:text-red-400 tracking-tighter leading-none">{overdueCount}</span>
              <span className="text-[12px] font-bold text-desk-text-secondary-light dark:text-desk-text-secondary-dark uppercase tracking-widest mt-2">Overdue</span>
            </div>
            <div className="w-px h-12 bg-black/5 dark:bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[28px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark tracking-tighter leading-none">{oldestWaiting}d</span>
              <span className="text-[12px] font-bold text-desk-text-secondary-light dark:text-desk-text-secondary-dark uppercase tracking-widest mt-2">Oldest Waiting</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="bg-desk-bg-light dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 group-hover:bg-desk-text-primary-light group-hover:text-desk-surface-light dark:group-hover:bg-desk-text-primary-dark dark:group-hover:text-desk-surface-dark transition-colors">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <p className="text-[11px] font-bold text-desk-text-secondary-light dark:text-desk-text-secondary-dark uppercase tracking-widest group-hover:text-desk-text-primary-light dark:group-hover:text-desk-text-primary-dark">Focus Action View</p>
          </div>
        </div>
      </section>

      {/* Intake if any */}
      {unassigned.length > 0 && <UnassignedSection threads={unassigned} />}

      {/* Bucket Overview Row */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-desk-text-primary-light/80 dark:text-desk-text-primary-dark/80 tracking-tight">Workstreams</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {bucketList.map(b => {
            const threads = state.threads.filter(t => t.bucket === b.name);
            const metrics = getMetrics(threads);
            return (
              <div 
                key={b.name}
                onClick={() => dispatch({ type: 'NAVIGATE', payload: { type: 'BUCKET', bucket: b.name } })}
                className="bg-white/40 dark:bg-desk-surface-dark/40 backdrop-blur-sm rounded-[24px] p-5 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md hover:bg-desk-surface-light dark:hover:bg-desk-surface-dark transition-all cursor-pointer group flex flex-col justify-between h-[190px]"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-2.5 h-2.5 rounded-full ${b.icon}`} />
                  <span className="text-[22px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark tracking-tighter">{metrics.count}</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark leading-tight mb-2.5">{b.name}</h3>
                  <div className="space-y-1.5">
                    {metrics.awaiting > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-desk-text-secondary-light dark:text-desk-text-secondary-dark" />
                        <span className="text-[9px] font-bold text-desk-text-primary-light/60 dark:text-desk-text-primary-dark/60 uppercase tracking-wider">{metrics.awaiting} Needs Reply</span>
                      </div>
                    )}
                    {metrics.overdue > 0 && (
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">{metrics.overdue} Overdue</span>
                      </div>
                    )}
                    {metrics.awaiting === 0 && b.name !== Bucket.CLEARED && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Clear</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      
    </div>
  );
};