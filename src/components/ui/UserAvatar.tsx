'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function UserAvatar() {
  const { isAuthenticated, isLoading, nextSession, user, loginWithGoogle } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div
        className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0"
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={loginWithGoogle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-all duration-200"
        title="Entrar com o Google"
      >
        {/* Google "G" SVG */}
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Entrar
      </button>
    );
  }

  // Get photo from Google session
  const photoUrl = nextSession?.user?.image;
  const displayName = user?.name || nextSession?.user?.name || '';
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n: string) => n[0].toUpperCase())
        .join('')
    : (user?.email?.[0]?.toUpperCase() ?? '?');

  const showPhoto = !!photoUrl && !imgError;

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500/40 group"
        title={displayName || user?.email || 'Usuário'}
      >
        {showPhoto ? (
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/[0.08] group-hover:ring-violet-500/40 transition-all duration-200">
            <Image
              src={photoUrl}
              alt={displayName || 'Avatar'}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/[0.08] group-hover:ring-violet-500/40 transition-all duration-200 select-none"
            style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)' }}
          >
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-52 bg-[#111113] border border-white/[0.06] rounded-xl shadow-2xl shadow-black/60 overflow-hidden py-1">
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <p className="text-xs font-medium text-zinc-200 truncate">{displayName || '—'}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email || ''}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
