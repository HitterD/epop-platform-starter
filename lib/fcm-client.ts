export interface FCMTokenData {
    token: string;
    platform: 'web' | 'ios' | 'android';
    deviceInfo?: {
        userAgent?: string;
        deviceId?: string;
        model?: string;
        osVersion?: string;
        appVersion?: string;
    };
}

export class FCMClientManager {
    private static instance: FCMClientManager;
    private isRegistered = false;
    private registrationPromise: Promise<boolean> | null = null;

    static getInstance(): FCMClientManager {
        if (!FCMClientManager.instance) {
            FCMClientManager.instance = new FCMClientManager();
        }
        return FCMClientManager.instance;
    }

    /**
     * Initialize Firebase Cloud Messaging
     */
    async initialize(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        try {
            // Check if Firebase is available
            if (!this.isFirebaseAvailable()) {
                console.warn('Firebase is not available. FCM will not work.');
                return false;
            }

            // Request notification permission
            const permission = await this.requestNotificationPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied');
                return false;
            }

            // Get FCM token
            const token = await this.getFCMToken();
            if (!token) {
                console.error('Failed to get FCM token');
                return false;
            }

            // Register token with server
            const success = await this.registerTokenWithServer(token);
            if (success) {
                this.isRegistered = true;
                console.log('FCM token registered successfully');
            }

            return success;
        } catch (error) {
            console.error('FCM initialization failed:', error);
            return false;
        }
    }

    /**
     * Check if Firebase is available
     */
    private isFirebaseAvailable(): boolean {
        return !!(window as any).firebase || !!(window as any).messaging;
    }

    /**
     * Request notification permission from user
     */
    private async requestNotificationPermission(): Promise<NotificationPermission> {
        if ('Notification' in window) {
            return await Notification.requestPermission();
        }
        return 'denied';
    }

    /**
     * Get FCM token from Firebase
     */
    private async getFCMToken(): Promise<string | null> {
        try {
            // This is a simplified implementation
            // In a real app, you would use the Firebase SDK

            // For now, return a mock token for development
            if (process.env.NODE_ENV !== 'production') {
                return `mock-fcm-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            // In production with Firebase SDK:
            // const messaging = (window as any).firebase.messaging();
            // const token = await messaging.getToken({
            //     vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            // });
            // return token;

            return null;
        } catch (error) {
            console.error('Failed to get FCM token:', error);
            return null;
        }
    }

    /**
     * Register FCM token with server
     */
    private async registerTokenWithServer(token: string): Promise<boolean> {
        try {
            const deviceInfo = this.getDeviceInfo();
            const platform = this.detectPlatform();

            const response = await fetch('/api/notify/register-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include auth token if available
                    ...(this.getAuthToken() && { 'Authorization': `Bearer ${this.getAuthToken()}` }),
                },
                credentials: 'include',
                body: JSON.stringify({
                    token,
                    platform,
                    deviceInfo,
                }),
            });

            if (!response.ok) {
                console.error('Failed to register FCM token:', response.status);
                return false;
            }

            const data = await response.json();
            console.log('FCM token registration response:', data);
            return true;
        } catch (error) {
            console.error('Failed to register FCM token with server:', error);
            return false;
        }
    }

    /**
     * Get device information for registration
     */
    private getDeviceInfo() {
        const userAgent = navigator.userAgent;

        return {
            userAgent,
            deviceId: this.getDeviceId(),
            model: this.getDeviceModel(),
            osVersion: this.getOSVersion(),
            appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        };
    }

    /**
     * Detect platform (web, ios, android)
     */
    private detectPlatform(): 'web' | 'ios' | 'android' {
        const userAgent = navigator.userAgent.toLowerCase();

        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            return 'ios';
        }

        if (userAgent.includes('android')) {
            return 'android';
        }

        return 'web';
    }

    /**
     * Get device ID (stored in localStorage for persistence)
     */
    private getDeviceId(): string {
        const STORAGE_KEY = 'fcm_device_id';

        let deviceId = localStorage.getItem(STORAGE_KEY);

        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(STORAGE_KEY, deviceId);
        }

        return deviceId;
    }

    /**
     * Get device model from user agent
     */
    private getDeviceModel(): string {
        const userAgent = navigator.userAgent;

        // Simple device detection
        if (userAgent.includes('iPhone')) {
            return 'iPhone';
        }
        if (userAgent.includes('iPad')) {
            return 'iPad';
        }
        if (userAgent.includes('Android')) {
            return 'Android Device';
        }
        if (userAgent.includes('Macintosh')) {
            return 'Mac';
        }
        if (userAgent.includes('Windows')) {
            return 'Windows PC';
        }

        return 'Unknown Device';
    }

    /**
     * Get OS version
     */
    private getOSVersion(): string {
        const userAgent = navigator.userAgent;

        // Simple OS version extraction
        const osMatch = userAgent.match(/(OS|Windows|Android|Mac OS X|Linux) ([\d._]+)/);
        if (osMatch) {
            return osMatch[2].replace(/_/g, '.');
        }

        return 'Unknown';
    }

    /**
     * Get auth token for API requests
     */
    private getAuthToken(): string | null {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'access_token') {
                return value || null;
            }
        }
        return null;
    }

    /**
     * Unregister FCM token
     */
    async unregisterToken(token?: string): Promise<boolean> {
        try {
            if (!token) {
                // Try to get current token
                token = await this.getFCMToken();
            }

            if (!token) {
                return true; // Nothing to unregister
            }

            const response = await fetch('/api/notify/unregister-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.getAuthToken() && { 'Authorization': `Bearer ${this.getAuthToken()}` }),
                },
                credentials: 'include',
                body: JSON.stringify({ token }),
            });

            if (response.ok) {
                this.isRegistered = false;
                console.log('FCM token unregistered successfully');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to unregister FCM token:', error);
            return false;
        }
    }

    /**
     * Get registration status
     */
    isTokenRegistered(): boolean {
        return this.isRegistered;
    }

    /**
     * Register token after user login
     */
    async registerAfterLogin(): Promise<void> {
        if (this.registrationPromise) {
            await this.registrationPromise;
            return;
        }

        this.registrationPromise = this.initialize();
        await this.registrationPromise;
        this.registrationPromise = null;
    }

    /**
     * Unregister token on logout
     */
    async unregisterOnLogout(): Promise<void> {
        if (this.isRegistered) {
            await this.unregisterToken();
        }
    }
}

// Export singleton instance
export const fcmClient = FCMClientManager.getInstance();

// Export utility functions
export const {
    initialize,
    unregisterToken,
    isTokenRegistered,
    registerAfterLogin,
    unregisterOnLogout,
} = FCMClientManager.prototype;