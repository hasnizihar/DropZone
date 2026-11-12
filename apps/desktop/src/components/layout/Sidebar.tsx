import React from 'react';
import {
  LayoutDashboard,
  Search,
  Download,
  Layers,
  History,
  Settings,
  Info,
  Circle,
} from 'lucide-react';
import { useAppStore, NavigationTab } from '@/stores/useAppStore';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const jobs = useAppStore((state) => state.jobs);
  const systemInfo = useAppStore((state) => state.systemInfo);
  const workerStatus = useAppStore((state) => state.workerStatus);

  const activeCount = jobs.filter(
    (j) => j.status === 'downloading' || j.status === 'pending'
  ).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analyzer', label: 'URL Analyzer', icon: Search },
    { id: 'downloads', label: 'Downloads', icon: Download, badge: activeCount },
    { id: 'batch', label: 'Batch Process', icon: Layers },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About', icon: Info },
  ];

  const ytdlpOk = systemInfo?.engines?.ytdlp?.isAvailable;
  const ffmpegOk = systemInfo?.engines?.ffmpeg?.isAvailable;
  const pythonOk = systemInfo?.engines?.python?.isAvailable;
  const workerState = workerStatus?.state || (workerStatus?.isAlive ? 'healthy' : 'starting');
  const workerOk = workerState === 'healthy';

  return (
    <aside className="w-56 bg-brand-surface border-r border-brand-border flex flex-col justify-between py-4 select-none">
      {/* Navigation List */}
      <div className="space-y-1 px-3">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-brand-grey px-3 mb-2">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-lime text-brand-black shadow-sm font-semibold'
                  : 'text-brand-grey hover:text-brand-white hover:bg-brand-hover'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-black stroke-[2.5]' : 'text-brand-grey'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-brand-black text-brand-lime'
                      : 'bg-brand-lime/20 text-brand-lime border border-brand-lime/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Engine Status Pill */}
      <div className="px-4 pt-3 border-t border-brand-border">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-brand-grey mb-2 flex items-center justify-between">
          <span>Engine Status</span>
          <Circle
            className={`w-2 h-2 fill-current ${
              ytdlpOk && ffmpegOk && workerOk ? 'text-brand-lime' : 'text-amber-400'
            }`}
          />
        </div>
        <div className="space-y-1.5 text-xs text-brand-grey font-mono">
          <div className="flex justify-between items-center">
            <span>Worker:</span>
            <span className={workerOk ? 'text-brand-lime font-bold' : 'text-amber-400 font-bold'}>
              {workerState}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>yt-dlp:</span>
            <span className={ytdlpOk ? 'text-brand-lime' : 'text-amber-400'}>
              {systemInfo?.engines?.ytdlp?.version || (ytdlpOk ? 'Ready' : 'Checking...')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>FFmpeg:</span>
            <span className={ffmpegOk ? 'text-brand-lime' : 'text-amber-400'}>
              {systemInfo?.engines?.ffmpeg?.version ? 'v' + systemInfo.engines.ffmpeg.version.split('-')[0] : (ffmpegOk ? 'Ready' : 'Checking...')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

