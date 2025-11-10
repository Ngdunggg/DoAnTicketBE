import { BadRequestException, Body, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@modules/prisma/prismas.service';
import { users } from 'generated/prisma';
import { CreateUserDto, LoginDto, RegisterDto } from '@common/dto/auth.dto';
import * as argon from 'argon2';
import { UserService } from '@modules/users/user.service';
import { OtpService } from '@common/services/otp.service';
import { EmailService } from '@common/services/email.service';
import { excludePassword } from '@common/utils/user.util';

@Injectable()
export class AuthService {
    constructor(
        private prismaService: PrismaService,
        private userService: UserService,
        private otpService: OtpService,
        private emailService: EmailService,
        private jwtService: JwtService
    ) {}

    /**
     * Register a user
     * @param email - The email of the user
     * @param full_name - The name of the user
     * @param phone - The phone number of the user
     * @param password - The password of the user
     * @returns The user if found, otherwise null
     */
    async registerAccount(registerDto: RegisterDto): Promise<{ message: string }> {
        // Kiểm tra email đã tồn tại chưa
        const existingUser = await this.userService.findByEmail(registerDto.email);

        if (existingUser) {
            throw new BadRequestException('Email đã được sử dụng');
        }

        // Kiểm tra rate limiting (không cho gửi OTP quá nhanh)
        const existingOtp = this.otpService.getRegisterData(registerDto.email);
        if (existingOtp) {
            throw new BadRequestException('Vui lòng đợi 1 phút trước khi gửi lại OTP');
        }

        // Tạo và gửi OTP, lưu thông tin đăng ký tạm thời
        const otp = this.otpService.generateOtp();
        this.otpService.storeOtp(registerDto.email, otp, registerDto as CreateUserDto);

        const emailSent = await this.emailService.sendOtpEmail(registerDto.email, otp);

        if (!emailSent) {
            // Xóa OTP nếu gửi email thất bại
            this.otpService.removeOtp(registerDto.email);
            throw new BadRequestException('Không thể gửi email');
        }

        return { message: 'OTP đã được gửi đến email của bạn' };
    }

    async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
        const isValid = this.otpService.verifyOtp(email, otp);
        if (!isValid) {
            throw new NotFoundException('Mã OTP không hợp lệ hoặc đã hết hạn');
        }

        // Lấy thông tin đăng ký đã lưu tạm
        const storedData = this.otpService.getRegisterData(email);
        if (!storedData) {
            throw new NotFoundException('Thông tin đăng ký không hợp lệ');
        }

        // Hash password và tạo user ngay lập tức
        const hashPassword = await argon.hash(storedData.password || '');
        await this.prismaService.users.create({
            data: {
                password: hashPassword,
                email: storedData.email,
                full_name: storedData.full_name,
                phone: storedData.phone,
            },
        });

        // Xóa thông tin tạm thời sau khi đăng ký thành công
        this.otpService.removeOtp(email);

        return {
            message: 'Đăng ký tài khoản thành công!',
        };
    }

    /**
     * Gửi lại mã OTP khi hết hạn (chỉ dành cho user chưa verify OTP)
     * @param email - Email của user
     * @returns Promise với message thành công
     */
    async resendOtp(email: string): Promise<{ message: string }> {
        // Kiểm tra xem có OTP đang chờ xác thực không (chỉ check trong memory)
        const storedData = this.otpService.getRegisterData(email);
        if (!storedData) {
            throw new NotFoundException('Thông tin đăng ký không hợp lệ');
        }

        // Tạo OTP mới
        const otp = this.otpService.generateOtp();

        // Lưu OTP mới (ghi đè OTP cũ) với thông tin đăng ký cũ
        this.otpService.storeOtp(email, otp, storedData);

        // Gửi email OTP mới
        await this.emailService.sendOtpEmail(email, otp);

        return { message: 'Mã OTP mới đã được gửi đến email của bạn' };
    }

    /**
     * Login a user
     * @param email - The email of the user
     * @param password - The password of the user
     * @returns The user if found, otherwise null
     */
    async login(loginDto: LoginDto): Promise<{ token: string; user: Omit<users, 'password'> }> {
        const user = await this.userService.findByEmailWithPassword(loginDto.email);

        if (!user) {
            throw new NotFoundException('Invalid email or password');
        }
        if (!user.password) {
            throw new NotFoundException('Invalid email or password');
        }
        const hashPassword = await argon.verify(user.password, loginDto.password);

        if (!hashPassword) {
            throw new NotFoundException('Invalid email or password');
        }

        // Tạo JWT token
        const payload = { sub: user.id, email: user.email };
        const token = this.jwtService.sign(payload);

        // Loại bỏ password khỏi response
        const userWithoutPassword = excludePassword(user);

        return { token, user: userWithoutPassword };
    }

    async loginWithGoogle(userId: string): Promise<{ token: string; user: Omit<users, 'password'> }> {
        const user = await this.userService.findUserById(userId);

        if (!user) {
            throw new NotFoundException('Invalid email or password');
        }

        // Tạo JWT token
        const payload = { sub: user.id, email: user.email };
        const token = this.jwtService.sign(payload);

        return { token, user };
    }

    async validateGoogleUser(createUserDto: CreateUserDto) {
        const user = await this.userService.findByEmail(createUserDto.email);

        if (user) {
            return user;
        }

        return await this.userService.createUser(createUserDto);
    }

    /**
     * Bước 1: Kiểm tra email tồn tại để đổi mật khẩu
     * @param email - Email của user
     * @returns Promise với message thành công
     */
    async checkEmailForPasswordChange(email: string): Promise<{ user: users; message: string }> {
        // Kiểm tra email có tồn tại trong hệ thống không
        const existingUser = await this.prismaService.users.findUnique({
            where: { email },
        });

        if (!existingUser) {
            throw new NotFoundException('Email không tồn tại');
        }

        return { user: existingUser, message: 'Email hợp lệ. Vui lòng nhập mật khẩu mới.' };
    }

    /**
     * Bước 2: Gửi OTP để xác nhận đổi mật khẩu
     * @param email - Email của user
     * @param newPassword - Mật khẩu mới
     * @returns Promise với message thành công
     */
    async sendChangePasswordOtp(email: string, newPassword: string): Promise<{ message: string }> {
        // Kiểm tra email có tồn tại không
        const existingUser = await this.prismaService.users.findUnique({
            where: { email },
        });

        if (!existingUser) {
            throw new NotFoundException('Email không tồn tại trong hệ thống');
        }

        // Kiểm tra rate limiting
        const existingOtp = this.otpService.getRegisterData(email);
        if (existingOtp) {
            throw new BadRequestException('Vui lòng đợi 1 phút trước khi gửi lại OTP');
        }

        // Tạo OTP và lưu thông tin đổi mật khẩu
        const otp = this.otpService.generateOtp();
        this.otpService.storeOtp(email, otp, {
            email,
            password: newPassword,
            full_name: existingUser.full_name,
            phone: existingUser.phone,
        } as CreateUserDto);

        // Gửi email OTP
        const emailSent = await this.emailService.sendOtpEmail(email, otp);
        if (!emailSent) {
            this.otpService.removeOtp(email);
            throw new BadRequestException('Không thể gửi email');
        }

        return { message: 'Mã OTP đã được gửi đến email của bạn để xác nhận đổi mật khẩu' };
    }

    /**
     * Bước 3: Xác nhận OTP và đổi mật khẩu
     * @param email - Email của user
     * @param otp - Mã OTP
     * @returns Promise với message thành công
     */
    async verifyChangePassword(email: string, otp: string): Promise<{ message: string }> {
        // Xác thực OTP
        const isValid = this.otpService.verifyOtp(email, otp);
        if (!isValid) {
            throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
        }

        // Lấy thông tin đổi mật khẩu đã lưu tạm
        const storedData = this.otpService.getRegisterData(email);
        if (!storedData || !storedData.password) {
            throw new BadRequestException('Thông tin đổi mật khẩu không hợp lệ');
        }

        // Hash mật khẩu mới và cập nhật
        const hashPassword = await argon.hash(storedData.password);
        await this.prismaService.users.update({
            where: { email },
            data: { password: hashPassword },
        });

        // Xóa thông tin tạm thời
        this.otpService.removeOtp(email);

        return { message: 'Đổi mật khẩu thành công!' };
    }
}
