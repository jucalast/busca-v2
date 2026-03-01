'use client';

import React from 'react';
import ParticleLoader from '@/features/shared/components/particle-loader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  if (authLoading) {
    return <ParticleLoader />;
  }

  if (!isAuthenticated) {
    return null; // Redirecionando para login
  }

  return <ParticleLoader />; // Mostra loader enquanto redireciona
}
