import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
    Req,
    Res,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    ChangePasswordDto,
    LoginDto,
    RegisterDto,
    SendOtpDto,
    VerifyOtpDto,
    CheckEmailDto,
    VerifyChangePasswordDto,
} from '@common/dto/auth.dto';
import { GoogleAuthGuard } from '@common/guards/google-auth.guard';
import { Public } from '@common/decorators/public.decorator';
import type { Request, Response } from 'express';
import { UserService } from '../users/user.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService
    ) {}

    @Public()
    @Post('register')
    async registerAccount(@Body() registerDto: RegisterDto) {
        return await this.authService.registerAccount(registerDto);
    }

    @Public()
    @Post('verify-otp')
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
        return await this.authService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp);
    }

    @Public()
    @Post('send-otp')
    async resendOtp(@Body() sendOtpDto: SendOtpDto) {
        return await this.authService.resendOtp(sendOtpDto.email);
    }

    @Public()
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(loginDto);

        // Set cookie
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/', // Ensure cookie is available for all paths
        });

        return result;
    }

    @Public()
    @Get('google')
    @UseGuards(GoogleAuthGuard)
    async googleLogin() {}

    @Public()
    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    async googleCallback(@Req() req: Request, @Res() res: Response) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        try {
            // Check if user exists from Google OAuth
            if (!req.user) {
                return res.redirect(
                    `${frontendUrl}/auth/callback?error=${encodeURIComponent('Không thể lấy thông tin từ Google. Vui lòng thử lại.')}`
                );
            }

            // Login with Google
            const response = await this.authService.loginWithGoogle(req.user.id);

            if (!response) {
                return res.redirect(
                    `${frontendUrl}/auth/callback?error=${encodeURIComponent('Đăng nhập thất bại. Vui lòng thử lại.')}`
                );
            }

            // Set cookie và redirect với success
            res.cookie('token', response.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                path: '/',
            });

            return res.redirect(
                `${frontendUrl}/auth/callback?token=${response.token}&user=${encodeURIComponent(JSON.stringify(response.user))}`
            );
        } catch (error) {
            // Handle any unexpected errors
            const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';
            return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
        }
    }

    @Get('profile')
    async getProfile(@Req() req: Request) {
        if (!req.user?.id) {
            throw new UnauthorizedException('Unauthorized');
        }

        const user = await this.userService.findUserById(req.user.id);

        if (!user) {
            throw new NotFoundException('User not available');
        }

        return user;
    }

    @Public()
    @Post('logout')
    logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        // Clear cookie với cùng options như khi set
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        });

        return { message: 'Đăng xuất thành công' };
    }

    @Public()
    @Post('check-email')
    async checkEmailForPasswordChange(@Body() checkEmailDto: CheckEmailDto) {
        return await this.authService.checkEmailForPasswordChange(checkEmailDto.email);
    }

    @Public()
    @Post('change-password')
    async sendChangePasswordOtp(@Body() changePasswordDto: ChangePasswordDto) {
        return await this.authService.sendChangePasswordOtp(changePasswordDto.email, changePasswordDto.password);
    }

    @Public()
    @Post('verify-password')
    async verifyChangePassword(@Body() verifyChangePasswordDto: VerifyChangePasswordDto) {
        return await this.authService.verifyChangePassword(verifyChangePasswordDto.email, verifyChangePasswordDto.otp);
    }
}
