'use client';

import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: 'fade-in 0.15s ease-out' }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-[400px] mx-4 rounded-[24px] overflow-hidden"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
          animation: 'scale-in 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2
              className="text-[17px] font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full transition-all duration-200 hover:bg-black/5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 py-4">
          <p
            className="text-[14px] leading-relaxed font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-6 pt-2">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] shadow-lg shadow-red-500/10"
            style={{
              backgroundColor: isDangerous ? '#ef4444' : 'var(--color-accent)',
              boxShadow: isDangerous ? '0 10px 15px -3px rgba(239, 68, 68, 0.1), 0 4px 6px -4px rgba(239, 68, 68, 0.1)' : 'var(--shadow-md)',
            }}
          >
            {confirmText}
          </button>

          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 text-gray-500 hover:bg-black/5 active:scale-[0.98]"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
