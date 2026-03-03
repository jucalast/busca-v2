import React from 'react';
import { Brain, X } from 'lucide-react';

interface HotzoneMapButtonProps {
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
}

export const HotzoneMapButton: React.FC<HotzoneMapButtonProps> = ({ rightSidebarOpen, setRightSidebarOpen }) => {
  return (
    <>
      {/* Botão de fechar quando o sidebar está aberto */}
      {rightSidebarOpen && (
        <button
          onClick={() => setRightSidebarOpen(false)}
          className="fixed top-24 z-[70] flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 rounded-l-xl transition-all duration-300 right-[80vw]"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      )}

      {/* Hotzone: faixa invisível no canto direito. O botão aparece ao passar o mouse nela via CSS group-hover */}
      {!rightSidebarOpen && (
        <div className="fixed top-0 right-0 h-screen w-10 z-[69] group pointer-events-auto flex items-start justify-end">
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="mt-24 flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 rounded-l-xl transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-x-0"
          >
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-[11px] font-semibold text-zinc-400 hidden md:inline">Mapa</span>
          </button>
        </div>
      )}
    </>
  );
};