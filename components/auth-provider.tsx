'use client';

import React, { useEffect, ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { AuthUtils } from '@/lib/auth-utils';

interface AuthProviderWrapperProps {
    children: ReactNode;
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
    useEffect(() => {
        // Initialize authentication system when component mounts
        AuthUtils.initializeAuth();

        // Optional: Setup global error handler for auth failures
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (event.reason?.message?.includes('401') ||
                event.reason?.message?.includes('unauthorized')) {
                // Token might be invalid, trigger logout
                AuthUtils.completeLogoutFlow();
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return <AuthProvider>{children}</AuthProvider>;
}