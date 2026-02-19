'use client';

import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-[#1a1a1d] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800">
          <div className="flex items-start gap-3">
            {isDangerous && (
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Message */}
        <div className="p-6">
          <p className="text-sm text-zinc-300 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isDangerous
                ? 'text-white bg-red-600 hover:bg-red-500'
                : 'text-white bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
