import React from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AuthForm from '@/features/auth/components/auth-form';

export default async function LoginPage() {
    const session = await auth();

    // Se o usuário estiver logado, não precisa acessar a rota de login
    if (session && session.user) {
        redirect('/');
    }

    return <AuthForm />;
}
