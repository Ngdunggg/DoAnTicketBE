import { IsOptional, IsString, IsUrl, IsBoolean, IsDate, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { user_role } from 'generated/prisma';

export class UpdateUserProfileDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    full_name?: string;

    @IsOptional()
    @IsUrl()
    avatar_url?: string;

    @IsOptional()
    @IsDate()
    @Transform(({ value }: { value: string | Date | undefined }) => (value ? new Date(value) : undefined))
    date_of_birth?: Date;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }: { value: string | boolean | undefined }) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'true' || value === '1';
        return undefined;
    })
    gender?: boolean;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    role?: user_role;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
