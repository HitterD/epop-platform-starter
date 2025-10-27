'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { AuthUtils } from '@/lib/auth-utils';

export function ExampleLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login, isAuthenticated } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Use the comprehensive login flow
            const result = await AuthUtils.completeLoginFlow(email, password, rememberMe);

            if (result.success) {
                // Login successful
                console.log('Login completed successfully');
                // You can redirect or update UI here
                window.location.href = '/dashboard';
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (error) {
            setError('An unexpected error occurred');
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await AuthUtils.completeLogoutFlow();
            console.log('Logout completed successfully');
            // Redirect to login page
            window.location.href = '/auth/login';
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Show logout button if already authenticated
    if (isAuthenticated) {
        return (
            <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Welcome Back!</h2>
                <p className="mb-6">You are currently logged in.</p>
                <button
                    onClick={handleLogout}
                    disabled={isLoading}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                    {isLoading ? 'Logging out...' : 'Log Out'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">Sign In</h2>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="your@email.com"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="••••••••"
                    />
                </div>

                <div className="flex items-center">
                    <input
                        id="rememberMe"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                        Remember me for 30 days
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                    <a href="/auth/password/request" className="text-blue-600 hover:text-blue-800">
                        Forgot your password?
                    </a>
                </p>
            </div>

            <div className="mt-4 text-xs text-gray-500 text-center">
                <p>This demo includes:</p>
                <ul className="mt-2 space-y-1">
                    <li>✅ JWT authentication with automatic refresh</li>
                    <li>✅ Secure password reset flow</li>
                    <li>✅ FCM push notification registration</li>
                    <li>✅ Device fingerprinting</li>
                    <li>✅ Cross-tab synchronization</li>
                </ul>
            </div>
        </div>
    );
}