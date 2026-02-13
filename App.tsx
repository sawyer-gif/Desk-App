import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { AppProvider, useAppState } from './store';
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


const AppContent: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { isSignedIn } = useAuth();
  const { threadId } = useParams<{ threadId?: string }>();

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

  if (!isSignedIn) {
    return <LoginPage />;
  }


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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {renderView()}
          </div>
        </div>

        <ThreadDetailErrorBoundary>
          <DetailPanel />
        </ThreadDetailErrorBoundary>
        <DraftModal />
      </div>
      <BuildStamp />
    </>
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

const RoutedApp: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/threads/:threadId" element={<AppContent />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

const App: React.FC = () => {
  return (
    <AppProvider>
      <RoutedApp />
    </AppProvider>
  );
};

export default App;
