import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { payment_method } from 'generated/prisma';

export class CreateOrganizerProfileDto {
    @IsString()
    @IsNotEmpty()
    organization_name: string;

    @IsString()
    @IsNotEmpty()
    full_name: string;

    @IsString()
    @IsNotEmpty()
    logo_url: string;

    @IsString()
    @IsNotEmpty()
    contact_phone: string;

    @IsString()
    @IsNotEmpty()
    contact_email: string;

    @IsString()
    @IsOptional()
    website?: string;

    @IsString()
    @IsNotEmpty()
    description_organization: string;
}

export class CreatePaymentMethodDto {
    @IsString()
    @IsNotEmpty()
    bank_name: string;

    @IsString()
    @IsOptional()
    bank_branch?: string;

    @IsString()
    @IsNotEmpty()
    account_number: string;

    @IsString()
    @IsNotEmpty()
    account_holder_name: string;

    @IsEnum(payment_method)
    @IsNotEmpty()
    payment_method: payment_method;
}
