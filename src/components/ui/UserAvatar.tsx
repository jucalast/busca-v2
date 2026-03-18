'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function UserAvatar({ isExpanded = true }: { isExpanded?: boolean }) {
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
        className={`flex items-center gap-2 rounded-lg font-medium transition-all duration-150 overflow-hidden ${isExpanded ? 'px-3 py-1.5 text-xs' : 'p-2 justify-center w-8 h-8'}`}
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
        <div className="w-4 h-4 flex-shrink-0 relative">
          <Image
            src="/google.png"
            alt="Google"
            fill
            className="object-contain"
          />
        </div>
        {isExpanded && <span>Entrar</span>}
      </button>
    );
  }

  const photoUrl = user?.image;
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
