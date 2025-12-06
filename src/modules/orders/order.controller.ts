import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from '@common/dto/order.dto';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // Giới hạn 5 request trong 1 phút
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
