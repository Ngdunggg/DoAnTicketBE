import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { UserService } from '@modules/users/user.service';

interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class JwtCookieStrategy extends PassportStrategy(Strategy, 'jwt-cookie') {
    constructor(private userService: UserService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                // Priority 1: Extract from cookies (for web browsers)
                (req: Request): string | null => {
                    return (req.cookies?.token as string) || null;
                },
                // Priority 2: Extract from Authorization header (for API clients, ngrok)
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.userService.findUserById(payload.sub);
        return user;
    }
}
