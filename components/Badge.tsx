
import React from 'react';
import { Priority } from '../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'blue' | 'green' | 'amber' | 'red';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide ${variants[variant]}`}>
      {children}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  // Fix: 'Med' replaced with 'Normal' to match the Priority type
  const variantMap: Record<Priority, 'red' | 'amber' | 'default'> = {
    High: 'red',
    Normal: 'amber',
    Low: 'default',
  };
  return <Badge variant={variantMap[priority]}>{priority}</Badge>;
};
