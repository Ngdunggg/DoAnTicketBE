import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateTicketDto } from './ticket.dto';
import { CreateOrganizerProfileDto, CreatePaymentMethodDto } from './organizer.dto';
import { CreateImageDto } from './image.dto';
import { CreateEventDateDto } from './event-date.dto';

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    category_id: string[];

    @IsString()
    @IsOptional()
    location?: string;

    @IsBoolean()
    @IsNotEmpty()
    is_online: boolean;

    @IsDate()
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => new Date(value))
    start_time: Date;

    @IsDate()
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => new Date(value))
    end_time: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateImageDto)
    @IsNotEmpty()
    images: CreateImageDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEventDateDto)
    @IsOptional()
    event_dates?: CreateEventDateDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTicketDto)
    @IsOptional()
    tickets?: CreateTicketDto[];

    // Sử dụng DTO đã tách
    @ValidateNested()
    @Type(() => CreateOrganizerProfileDto)
    @IsNotEmpty()
    organizer_profile: CreateOrganizerProfileDto;

    @ValidateNested()
    @Type(() => CreatePaymentMethodDto)
    @IsNotEmpty()
    payment_method: CreatePaymentMethodDto;
}

export class UpdateEventDto {
    @IsString()
    @IsNotEmpty()
    event_id: string;
}