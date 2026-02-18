import React, { useEffect, useState } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { AppProvider, useAppState, DETAIL_PANEL_MIN_WIDTH, DETAIL_PANEL_MAX_WIDTH } from './store';
import { Header } from './components/Header';
import { DetailPanel } from './components/DetailPanel';
import { DraftModal } from './components/DraftModal';
import { DashboardView } from './components/DashboardView';
import { BucketFocusedView } from './components/BucketFocusedView';
import { FocusActionView } from './components/FocusActionView';
import { LoginPage } from './components/LoginPage';
import { useAuth } from "@clerk/clerk-react";
import { ThreadDetailErrorBoundary } from './components/ThreadDetailErrorBoundary';
import { BuildStamp } from './components/BuildStamp';
import { PanelRightOpen } from 'lucide-react';

const clampDetailWidth = (value: number) =>
  Math.max(DETAIL_PANEL_MIN_WIDTH, Math.min(value, DETAIL_PANEL_MAX_WIDTH));

const AppContent: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { isSignedIn } = useAuth();
  const { threadId } = useParams<{ threadId?: string }>();
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (threadId && state.selectedThreadId !== threadId) {
      dispatch({ type: 'SELECT_THREAD', payload: threadId });
    } else if (!threadId && state.selectedThreadId) {
      dispatch({ type: 'SELECT_THREAD', payload: null });
    }
  }, [threadId, state.selectedThreadId, dispatch]);

  useEffect(() => {
    if (typeof __BUILD_INFO__ !== 'undefined') {
      console.info(`[Desk] build ${__BUILD_INFO__.commit} @ ${__BUILD_INFO__.buildTime}`);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = clampDetailWidth(window.innerWidth - event.clientX);
      dispatch({ type: 'SET_DETAIL_PANEL_WIDTH', payload: nextWidth });
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, dispatch]);

  if (!isSignedIn) {
    return <LoginPage />;
  }

  const handleShowPanel = () => {
    dispatch({ type: 'SET_DETAIL_PANEL_OPEN', payload: true });
  };

  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (state.isDetailPanelCollapsed) {
      handleShowPanel();
    }
    setIsResizing(true);
  };

  const renderView = () => {
    switch (state.currentView.type) {
      case 'DASHBOARD':
        return <DashboardView />;
      case 'BUCKET':
        return <BucketFocusedView bucket={state.currentView.bucket} />;
      case 'FOCUS':
        return <FocusActionView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <>
      <div className="flex h-screen bg-desk-bg-light dark:bg-desk-bg-dark overflow-hidden text-desk-text-primary-light dark:text-desk-text-primary-dark transition-colors duration-500">
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Header />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {renderView()}
          </div>
          {state.isDetailPanelCollapsed && (
            <button
              onClick={handleShowPanel}
              className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow border border-black/5 text-[12px] font-semibold text-desk-text-primary-light dark:bg-zinc-900 dark:border-white/5 dark:text-zinc-100"
            >
              <PanelRightOpen className="w-4 h-4" />
              Open Thread
            </button>
          )}
        </div>

        <div
          className={`w-1.5 cursor-col-resize bg-transparent hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            isResizing ? 'bg-black/10 dark:bg-white/10' : ''
          } ${state.isDetailPanelCollapsed ? 'opacity-70' : ''}`}
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize thread inspector"
        >
          <div className="w-px h-full mx-auto bg-black/10 dark:bg-white/10" />
        </div>

        <div
          className="relative h-full flex-shrink-0"
          style={{ width: state.isDetailPanelCollapsed ? 0 : state.detailPanelWidth }}
        >
          <div
            className={`absolute top-0 right-0 h-full flex flex-col transition-transform duration-300 ease-out ${
              state.isDetailPanelCollapsed ? 'translate-x-full pointer-events-none opacity-0' : 'translate-x-0 opacity-100'
            }`}
            style={{ width: state.detailPanelWidth }}
          >
            <ThreadDetailErrorBoundary>
              <DetailPanel />
            </ThreadDetailErrorBoundary>
          </div>
        </div>
      </div>
      <DraftModal />
      <BuildStamp />
    </>
  );
};

const GoogleCallback: React.FC = () => {
  const navigateBack = React.useCallback(() => {
    window.location.replace('/');
  }, []);

  useEffect(() => {
    const id = setTimeout(navigateBack, 1200);
    return () => clearTimeout(id);
  }, [navigateBack]);

  return (
    <div className="flex h-screen items-center justify-center bg-desk-bg-light dark:bg-desk-bg-dark text-center p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400 mb-3">Google OAuth</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Connecting your account…</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">You will be redirected back to Desk automatically.</p>
      </div>
    </div>
  );
};

const NotFound: React.FC = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-desk-bg-light dark:bg-desk-bg-dark text-center p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400 mb-3">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">This path doesn&apos;t exist</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Try navigating back to the Desk dashboard.
        </p>
      </div>
    </div>
  );
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<AppContent />} />
    <Route path="/threads/:threadId" element={<AppContent />} />
    <Route path="/google/callback" element={<GoogleCallback />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
};

export default App;
