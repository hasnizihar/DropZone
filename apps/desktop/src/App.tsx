import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyzerPage } from './pages/AnalyzerPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { BatchPage } from './pages/BatchPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { useAppStore } from './stores/useAppStore';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export const App: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeTab);
  const init = useAppStore((state) => state.init);
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);

  useEffect(() => {
    init();
  }, [init]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'analyzer':
        return <AnalyzerPage />;
      case 'downloads':
        return <DownloadsPage />;
      case 'batch':
        return <BatchPage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      case 'about':
        return <AboutPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-brand-black text-brand-white overflow-hidden font-sans select-none">
      {/* Draggable Title Bar */}
      <TitleBar />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto bg-brand-black">
          {renderActiveView()}
        </main>
      </div>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-xl border text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-brand-surface border-brand-lime text-brand-white'
                : toast.type === 'error'
                ? 'bg-brand-surface border-red-500 text-red-400'
                : 'bg-brand-surface border-brand-border text-brand-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-brand-lime flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-brand-grey flex-shrink-0" />}
            <span>{toast.text}</span>
            <button
              onClick={() => clearToast()}
              className="text-brand-grey hover:text-brand-white ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
