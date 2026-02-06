import React from 'react';
import { AppProvider, useAppState } from './store';
import { Header } from './components/Header';
import { DetailPanel } from './components/DetailPanel';
import { DraftModal } from './components/DraftModal';
import { DashboardView } from './components/DashboardView';
import { BucketFocusedView } from './components/BucketFocusedView';
import { FocusActionView } from './components/FocusActionView';
import { LoginPage } from './components/LoginPage';
import { useAuth } from "@clerk/clerk-react";


const AppContent: React.FC = () => {
  const { state } = useAppState();
  const { isSignedIn } = useAuth();


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
    <div className="flex h-screen bg-desk-bg-light dark:bg-desk-bg-dark overflow-hidden text-desk-text-primary-light dark:text-desk-text-primary-dark transition-colors duration-500">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {renderView()}
        </div>
      </div>

      <DetailPanel />
      <DraftModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;