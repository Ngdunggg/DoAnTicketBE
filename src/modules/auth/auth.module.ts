import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '@modules/prisma/prismas.service';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import googleOauthConfig from '@config/google-oauth.config';
import jwtConfig from '@config/jwt.config';
import { GoogleStrategy } from '@common/strategies/google.strategy';
import { JwtCookieStrategy } from '@common/strategies/jwt-cookie.strategy';
import { OtpService } from '@common/services/otp.service';
import { EmailService } from '@common/services/email.service';
import { UserService } from '@modules/users/user.service';

@Module({
    imports: [
        PassportModule,
        ConfigModule.forFeature(googleOauthConfig),
        ConfigModule.forFeature(jwtConfig),
        JwtModule.registerAsync({
            imports: [ConfigModule.forFeature(jwtConfig)],
            useFactory: (jwtConfiguration: ConfigType<typeof jwtConfig>) => ({
                secret: jwtConfiguration.secret,
                signOptions: { expiresIn: jwtConfiguration.expiresIn },
            }),
            inject: [jwtConfig.KEY],
        }),
    ],
    providers: [AuthService, PrismaService, GoogleStrategy, JwtCookieStrategy, OtpService, EmailService, UserService],
    controllers: [AuthController],
})
export class AuthModule {}
