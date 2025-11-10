import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateUserDto } from '@common/dto/auth.dto';
import { OTP_VERIFIED } from '@/shared/constants/constants';

interface OtpData {
    code: string;
    expiresAt: Date;
    registerData?: CreateUserDto;
    attempts: number;
    lastAttempt?: Date;
}

@Injectable()
export class OtpService implements OnModuleInit {
    private otpStorage = new Map<string, OtpData>();
    private cleanupInterval: NodeJS.Timeout;

    onModuleInit() {
        // Cleanup OTP hết hạn mỗi 30 giây
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredOtps();
        }, 30000);
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    storeOtp(email: string, otp: string, registerData?: CreateUserDto): void {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5); // OTP hết hạn sau 5 phút

        this.otpStorage.set(email, {
            code: otp,
            expiresAt,
            registerData,
            attempts: 0,
        });
    }

    private cleanupExpiredOtps(): void {
        const now = new Date();
        for (const [email, data] of this.otpStorage.entries()) {
            if (now > data.expiresAt) {
                this.otpStorage.delete(email);
                console.log(`Cleaned up expired OTP for email: ${email}`);
            }
        }
    }

    verifyOtp(email: string, inputOtp: string): boolean {
        const storedOtp = this.otpStorage.get(email);

        if (!storedOtp) {
            return false;
        }

        // Kiểm tra hết hạn
        if (new Date() > storedOtp.expiresAt) {
            this.otpStorage.delete(email);
            return false;
        }

        // Kiểm tra số lần thử (tối đa 3 lần)
        if (storedOtp.attempts >= 3) {
            this.otpStorage.delete(email);
            return false;
        }

        // Kiểm tra rate limiting (không cho thử quá nhanh)
        if (storedOtp.lastAttempt) {
            const timeDiff = new Date().getTime() - storedOtp.lastAttempt.getTime();
            if (timeDiff < 10000) {
                // 10 giây
                return false;
            }
        }

        storedOtp.attempts++;
        storedOtp.lastAttempt = new Date();

        if (storedOtp.code !== inputOtp) {
            return false;
        }

        return true;
    }

    getRegisterData(email: string): CreateUserDto | null {
        const storedOtp = this.otpStorage.get(email);
        return storedOtp?.registerData || null;
    }

    markOtpAsVerified(email: string): void {
        const storedOtp = this.otpStorage.get(email);
        if (storedOtp) {
            storedOtp.code = OTP_VERIFIED;
        }
    }

    isOtpVerified(email: string): boolean {
        const storedOtp = this.otpStorage.get(email);
        return storedOtp?.code === OTP_VERIFIED;
    }

    removeOtp(email: string): void {
        this.otpStorage.delete(email);
    }

    // Thống kê OTP hiện tại (để debug)
    getStats(): { total: number; expired: number } {
        const now = new Date();
        let expired = 0;

        for (const data of this.otpStorage.values()) {
            if (now > data.expiresAt) {
                expired++;
            }
        }

        return {
            total: this.otpStorage.size,
            expired,
        };
    }
}
