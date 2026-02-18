import React from 'react';
import { GoogleStatus } from '../types';

interface Props {
  status: GoogleStatus;
  onConnect: () => Promise<void> | void;
}

const ConnectGoogleButton: React.FC<Props> = ({ status, onConnect }) => {
  const isConnecting = status === 'CONNECTING';
  return (
    <button
      onClick={onConnect}
      disabled={isConnecting}
      className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-60"
    >
      {isConnecting ? 'Connecting…' : 'Connect Gmail'}
    </button>
  );
};

export default ConnectGoogleButton;
