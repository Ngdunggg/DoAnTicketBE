import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { user_role } from 'generated/prisma';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @MinLength(8)
    @MaxLength(64)
    @IsNotEmpty()
    password: string;

    @IsString()
    full_name: string;

    @IsString()
    phone: string;
}

export class SendOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class VerifyOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    otp: string;
}

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(64)
    password: string;
}

export class CreateUserDto {
    @IsString()
    @IsOptional()
    google_id?: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    full_name: string;

    @IsString()
    @IsOptional()
    avatar_url?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsOptional()
    gender?: boolean;

    @IsOptional()
    date_of_birth?: Date;

    @IsString()
    @IsOptional()
    role?: user_role;
}

export class CheckEmailDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class ChangePasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(64)
    password: string;
}

export class VerifyChangePasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    otp: string;
}