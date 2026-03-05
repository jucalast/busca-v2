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
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: 'fade-in 0.15s ease-out' }}
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full max-w-[420px] mx-4 rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          animation: 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-start gap-3">
            {isDangerous && (
              <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--color-destructive-muted)' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
              </div>
            )}
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors duration-150"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        </div>
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-4"
          style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/[0.08] transition-all duration-150"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-all duration-150"
            style={{
              backgroundColor: isDangerous ? 'var(--color-destructive)' : 'var(--color-accent)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
