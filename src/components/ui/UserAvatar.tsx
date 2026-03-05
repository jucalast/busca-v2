'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function UserAvatar() {
  const { isAuthenticated, isLoading, nextSession, user, loginWithGoogle } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div
        className="w-8 h-8 rounded-full animate-pulse flex-shrink-0"
        style={{ backgroundColor: 'var(--color-surface-hover)' }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={loginWithGoogle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
        style={{
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-hover)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-active)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.borderColor = 'var(--color-border-strong)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
        title="Entrar com o Google"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Entrar
      </button>
    );
  }

  const photoUrl = nextSession?.user?.image;
  const displayName = user?.name || nextSession?.user?.name || '';
  const initials = displayName
    ? displayName.split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0].toUpperCase()).join('')
    : (user?.email?.[0]?.toUpperCase() ?? '?');

  const showPhoto = !!photoUrl && !imgError;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none group"
        title={displayName || user?.email || 'Usuário'}
      >
        {showPhoto ? (
          <div
            className="relative w-8 h-8 rounded-full overflow-hidden transition-all duration-150"
            style={{ boxShadow: '0 0 0 2px var(--color-border)' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-ring)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-border)')}
          >
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white select-none transition-all duration-150"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)',
              boxShadow: '0 0 0 2px var(--color-border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-ring)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-border)')}
          >
            {initials}
          </div>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 w-52 rounded-xl overflow-hidden py-1"
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-popover)',
              animation: 'fade-in-up 0.15s ease-out',
            }}
          >
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{displayName || '—'}</p>
              <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{user?.email || ''}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
