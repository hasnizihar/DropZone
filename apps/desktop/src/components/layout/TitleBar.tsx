import React from 'react';
import { Minus, Square, X, Download } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const TitleBar: React.FC = () => {
  const windowControl = useAppStore((state) => state.windowControl);
  const systemInfo = useAppStore((state) => state.systemInfo);

  return (
    <div className="h-10 bg-brand-black border-b border-brand-border flex items-center justify-between px-3 select-none drag-region z-50">
      {/* Brand & App Title */}
      <div className="flex items-center space-x-2.5 no-drag">
        <div className="w-5 h-5 rounded bg-brand-lime flex items-center justify-center text-brand-black">
          <Download className="w-3.5 h-3.5 stroke-[3]" />
        </div>
        <span className="font-bold text-sm tracking-wider text-brand-white">DROPZONE</span>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-surface text-brand-lime border border-brand-lime/20">
          v{systemInfo?.version || '1.0.0'}
        </span>
      </div>

      {/* Center Drag Area */}
      <div className="flex-1 h-full drag-region" />

      {/* Window Controls */}
      <div className="flex items-center space-x-1 no-drag">
        <button
          onClick={() => windowControl('minimize')}
          className="w-7 h-7 flex items-center justify-center rounded text-brand-grey hover:text-brand-white hover:bg-brand-surface transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => windowControl('maximize')}
          className="w-7 h-7 flex items-center justify-center rounded text-brand-grey hover:text-brand-white hover:bg-brand-surface transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => windowControl('close')}
          className="w-7 h-7 flex items-center justify-center rounded text-brand-grey hover:text-white hover:bg-red-600 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

