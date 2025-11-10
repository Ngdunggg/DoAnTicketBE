import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ticket_type_status } from 'generated/prisma';

export class CreateTicketDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @IsNotEmpty()
    price: number;

    @IsNumber()
    @IsNotEmpty()
    initial_quantity: number;

    @IsEnum(ticket_type_status)
    @IsNotEmpty()
    status: ticket_type_status;

    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateTicketsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTicketDto)
    @IsNotEmpty()
    tickets: CreateTicketDto[];
}
