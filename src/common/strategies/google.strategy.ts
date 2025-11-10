import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Profile } from 'passport-google-oauth20';
import { AuthService } from '@modules/auth/auth.service';
import googleOauthConfig from '@config/google-oauth.config';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        @Inject(googleOauthConfig.KEY)
        private googleOauthConfiguration: ConfigType<typeof googleOauthConfig>,
        private authService: AuthService
    ) {
        super({
            clientID: googleOauthConfiguration.clientID,
            clientSecret: googleOauthConfiguration.clientSecret,
            callbackURL: googleOauthConfiguration.callbackURL,
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback): Promise<void> {
        const user = await this.authService.validateGoogleUser({
            email: profile.emails?.[0]?.value || '',
            full_name: profile.displayName,
            avatar_url: profile.photos?.[0]?.value,
            google_id: profile.id,
            password: '',
        });
        done(null, user);
    }
}
