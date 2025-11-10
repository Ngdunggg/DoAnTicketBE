import { IsString, IsEmail, IsArray, ValidateNested, IsOptional, IsEnum, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { payment_method } from 'generated/prisma';

export class OrderItemDto {
    @IsString()
    @IsNotEmpty()
    ticket_type_id: string;

    @IsNumber()
    @IsNotEmpty()
    quantity: number;
}

export class CreateOrderDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    order_items: OrderItemDto[];

    @IsEmail()
    @IsNotEmpty()
    buyer_email: string;

    @IsString()
    @IsNotEmpty()
    buyer_phone: string;

    @IsEnum(payment_method)
    @IsOptional()
    payment_method?: payment_method;
}
