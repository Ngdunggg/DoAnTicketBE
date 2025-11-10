import { registerAs } from '@nestjs/config';

/**
 * Google OAuth configuration
 * @returns {Object} Google OAuth configuration
 */
export default registerAs('google-oauth', () => ({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback',
}));
