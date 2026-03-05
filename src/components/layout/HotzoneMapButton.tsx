import React from 'react';
import { Brain, X } from 'lucide-react';

interface HotzoneMapButtonProps {
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
}

export const HotzoneMapButton: React.FC<HotzoneMapButtonProps> = ({ rightSidebarOpen, setRightSidebarOpen }) => {
  return (
    <>
      {/* Close button when sidebar is open */}
      {rightSidebarOpen && (
        <button
          onClick={() => setRightSidebarOpen(false)}
          className="fixed top-24 z-[70] flex items-center gap-2 px-3 py-2 rounded-l-lg transition-all duration-200 right-[80vw]"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRight: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-3)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
        >
          <X className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      )}

      {/* Hotzone: invisible strip on right edge */}
      {!rightSidebarOpen && (
        <div className="fixed top-0 right-0 h-screen w-10 z-[69] group pointer-events-auto flex items-start justify-end">
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="mt-24 flex items-center gap-2 px-3 py-2 rounded-l-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRight: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          >
            <Brain className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <span className="text-[11px] font-medium hidden md:inline" style={{ color: 'var(--color-text-tertiary)' }}>Mapa</span>
          </button>
        </div>
      )}
    </>
  );
};