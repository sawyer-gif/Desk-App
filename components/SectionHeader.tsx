
import React from 'react';

interface SectionHeaderProps {
  title: string;
  description: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, className }) => (
  <div className={`mb-6 ${className}`}>
    <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">{title}</h2>
    <p className="text-[14px] text-[#86868B] mt-0.5">{description}</p>
  </div>
);
