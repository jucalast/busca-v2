'use client';

import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmDialogProps) {
  const { isDark } = useSidebar();

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${isDark ? 'bg-black/70' : 'bg-black/40'} backdrop-blur-md`}
        style={{ animation: 'fade-in 0.15s ease-out' }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={`relative z-10 w-full max-w-[400px] mx-4 rounded-[24px] overflow-hidden border shadow-2xl transition-all duration-300 ${
          isDark 
            ? 'bg-zinc-900/90 border-white/10 text-white' 
            : 'bg-white/95 border-black/5 text-zinc-950'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          animation: 'scale-in 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2
              className={`text-[17px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className={`p-1.5 rounded-full transition-all duration-200 ${isDark ? 'hover:bg-white/5 text-zinc-500 hover:text-white' : 'hover:bg-black/5 text-gray-400 hover:text-gray-600'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 py-4">
          <p
            className={`text-[14px] leading-relaxed font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-6 pt-2">
          <button
            onClick={onConfirm}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] shadow-lg ${
              isDangerous 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : (isDark ? 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-white/5' : 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/10')
            }`}
          >
            {confirmText}
          </button>

          <button
            onClick={onCancel}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
              isDark 
                ? 'text-zinc-400 hover:bg-white/5 hover:text-white' 
                : 'text-zinc-500 hover:bg-black/5'
            }`}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
