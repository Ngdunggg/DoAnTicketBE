import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from '@common/dto/order.dto';
import type { Request } from 'express';

@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    async createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: Request) {
        const userId = req.user?.id;

        if (!userId) {
            throw new Error('User not authenticated');
        }
        return this.orderService.createOrder(createOrderDto, userId);
    }

    @Get(':id')
    async getOrderById(@Param('id') orderId: string, @Req() req: Request) {
        const userId = req.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return this.orderService.getOrderById(orderId, userId);
    }
}
