import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';

export default async function LoginPage() {
    const session = await getServerSession();

    // Se o usuário estiver logado, não precisa acessar a rota de login
    if (session && session.user) {
        redirect('/');
    }

    return <AuthForm />;
}
