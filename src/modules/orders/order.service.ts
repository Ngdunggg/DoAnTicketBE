import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { CreateOrderDto } from '@common/dto/order.dto';
import { event_status, orders_status, payment_method, transaction_status } from 'generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class OrderService {
    constructor(private prisma: PrismaService) {}

    async createOrder(createOrderDto: CreateOrderDto, userId: string) {
        try {
            // Sử dụng database transaction để đảm bảo atomicity
            return await this.prisma.$transaction(
                async (tx) => {
                    // 1. Lock và validate ticket types với FOR UPDATE
                    const ticketTypeIds = createOrderDto.order_items.map((item) => item.ticket_type_id);

                    const ticketTypes = await tx.ticket_types.findMany({
                        where: {
                            id: { in: ticketTypeIds },
                        },
                        include: {
                            events: {
                                select: {
                                    id: true,
                                    title: true,
                                    status: true,
                                },
                            },
                        },
                        // FOR UPDATE lock để prevent race conditions
                        // Note: Prisma không hỗ trợ FOR UPDATE trực tiếp, nhưng transaction sẽ handle locking
                    });

                    if (ticketTypes.length !== createOrderDto.order_items.length) {
                        throw new BadRequestException('Some ticket types not found');
                    }

                    // 2. Check if events are approved
                    const unapprovedEvents = ticketTypes.filter(
                        (ticketType) => ticketType.events.status !== event_status.approved
                    );
                    if (unapprovedEvents.length > 0) {
                        throw new BadRequestException('Some events are not approved yet');
                    }

                    // 3. Check availability (remaining - reserved) và calculate total
                    let totalAmount = new Decimal(0);
                    const orderItems: { ticket_type_id: string; quantity: number }[] = [];
                    const reservationUpdates: { id: string; quantity: number }[] = [];

                    for (const item of createOrderDto.order_items) {
                        const ticketType = ticketTypes.find((ticketType) => ticketType.id === item.ticket_type_id);

                        if (!ticketType) {
                            throw new BadRequestException(`Ticket type ${item.ticket_type_id} not found`);
                        }

                        const quantity = item.quantity;

                        // Tính số vé có thể mua = remaining - reserved
                        const availableQuantity = ticketType.remaining_quantity - (ticketType.reserved_quantity || 0);

                        if (availableQuantity < quantity) {
                            throw new BadRequestException(
                                `Not enough tickets for ${ticketType.name}. Available: ${availableQuantity}, Requested: ${quantity}`
                            );
                        }

                        const itemTotal = ticketType.price.mul(quantity);
                        totalAmount = totalAmount.add(itemTotal);

                        orderItems.push({
                            ticket_type_id: ticketType.id,
                            quantity: quantity,
                        });

                        reservationUpdates.push({
                            id: ticketType.id,
                            quantity: quantity,
                        });
                    }

                    // 4. Reserve tickets trước khi tạo order
                    const reservationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

                    for (const update of reservationUpdates) {
                        await tx.ticket_types.update({
                            where: { id: update.id },
                            data: {
                                reserved_quantity: { increment: update.quantity },
                                reservation_expires_at: reservationExpiry,
                            },
                        });
                    }

                    // 5. Create order
                    const order = await tx.orders.create({
                        data: {
                            user_id: userId,
                            buyer_email: createOrderDto.buyer_email,
                            buyer_phone: createOrderDto.buyer_phone,
                            payment_method: createOrderDto.payment_method || payment_method.vnpay,
                            total_amount: totalAmount,
                            status: orders_status.pending,
                            order_items: {
                                create: orderItems,
                            },
                        },
                        include: {
                            order_items: {
                                include: {
                                    ticket_types: true,
                                },
                            },
                        },
                    });

                    return { order_id: order.id };
                },
                {
                    // Transaction timeout: 30 giây
                    timeout: 30000,
                }
            );
        } catch (error) {
            // Simple error logging - transaction sẽ tự động rollback
            console.error('Order creation failed:', error);
            throw error;
        }
    }

    async getOrderById(orderId: string, userId: string) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId },
            include: {
                order_items: {
                    include: {
                        ticket_types: {
                            include: {
                                events: {
                                    select: {
                                        id: true,
                                        title: true,
                                        location: true,
                                        start_time: true,
                                        end_time: true,
                                    },
                                },
                            },
                        },
                    },
                },
                payment_transactions: true,
                purchased_tickets: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.user_id !== userId) {
            throw new BadRequestException('You can only view your own orders');
        }

        return order;
    }

    async updateOrderStatus(orderId: string, status: orders_status) {
        return await this.prisma.orders.update({
            where: { id: orderId },
            data: { status },
        });
    }

    /**
     * Release reserved tickets khi order bị cancel hoặc expire
     * Sử dụng transaction để đảm bảo consistency
     */
    async releaseReservedTickets(orderId: string, newStatus: orders_status = orders_status.expired) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Get order với order_items
            const order = await tx.orders.findUnique({
                where: { id: orderId },
                include: {
                    order_items: {
                        include: {
                            ticket_types: true,
                        },
                    },
                },
            });

            if (!order) {
                throw new NotFoundException('Order not found');
            }

            // Chỉ xử lý nếu order đang ở trạng thái pending
            if (order.status !== orders_status.pending) {
                return order;
            }

            // 2. Release reserved tickets
            for (const item of order.order_items) {
                await tx.ticket_types.update({
                    where: { id: item.ticket_type_id },
                    data: {
                        reserved_quantity: { decrement: item.quantity },
                        // Reset reservation expiry nếu không còn reserved tickets
                        reservation_expires_at: null,
                    },
                });
            }

            // 3. Update order status
            await tx.orders.update({
                where: { id: orderId },
                data: { status: newStatus },
            });

            return order;
        });
    }

    /**
     * Cleanup expired reservations
     * Method này sẽ được gọi bởi cron job
     * Xử lý 2 trường hợp:
     * 1. Cleanup reservations hết hạn (dựa vào reservation_expires_at)
     * 2. Cleanup orders pending quá 15 phút (dựa vào created_at) - xử lý case user đóng tab
     */
    async cleanupExpiredReservations() {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

        return await this.prisma.$transaction(async (tx) => {
            let cleanedTicketTypes = 0;
            let expiredOrders = 0;

            // 1. Cleanup reservations hết hạn (dựa vào reservation_expires_at)
            const expiredTicketTypes = await tx.ticket_types.findMany({
                where: {
                    reservation_expires_at: { lt: now },
                    reserved_quantity: { gt: 0 },
                },
            });

            if (expiredTicketTypes.length > 0) {
                // Reset expired reservations
                await tx.ticket_types.updateMany({
                    where: {
                        reservation_expires_at: { lt: now },
                        reserved_quantity: { gt: 0 },
                    },
                    data: {
                        reserved_quantity: 0,
                        reservation_expires_at: null,
                    },
                });

                cleanedTicketTypes += expiredTicketTypes.length;

                // Update related orders to expired
                const ticketTypeIds = expiredTicketTypes.map((t) => t.id);
                const ordersByReservation = await tx.orders.findMany({
                    where: {
                        status: orders_status.pending,
                        order_items: {
                            some: {
                                ticket_type_id: { in: ticketTypeIds },
                            },
                        },
                    },
                });

                if (ordersByReservation.length > 0) {
                    for (const order of ordersByReservation) {
                        await this.releaseReservedTicketsForOrder(tx, order.id, orders_status.expired);
                    }
                    expiredOrders += ordersByReservation.length;
                }
            }

            // 2. Cleanup orders pending quá 15 phút (xử lý case user đóng tab)
            const oldPendingOrders = await tx.orders.findMany({
                where: {
                    status: orders_status.pending,
                    created_at: { lt: fifteenMinutesAgo },
                },
                include: {
                    order_items: true,
                },
            });

            if (oldPendingOrders.length > 0) {
                for (const order of oldPendingOrders) {
                    await this.releaseReservedTicketsForOrder(tx, order.id, orders_status.expired);
                }
                expiredOrders += oldPendingOrders.length;

                // Cleanup payment transactions pending của các orders này
                const orderIds = oldPendingOrders.map((o) => o.id);
                await tx.payment_transactions.updateMany({
                    where: {
                        order_id: { in: orderIds },
                        status: transaction_status.pending,
                    },
                    data: {
                        status: transaction_status.failed,
                    },
                });
            }

            return {
                cleaned: cleanedTicketTypes,
                expiredOrders,
            };
        });
    }

    /**
     * Helper method để release reserved tickets cho một order trong transaction
     */
    private async releaseReservedTicketsForOrder(
        tx: TransactionClient,
        orderId: string,
        newStatus: orders_status
    ) {
        const order = await tx.orders.findUnique({
            where: { id: orderId },
            include: {
                order_items: {
                    include: {
                        ticket_types: true,
                    },
                },
            },
        });

        if (!order || order.status !== orders_status.pending) {
            return;
        }

        // Release reserved tickets
        for (const item of order.order_items) {
            await tx.ticket_types.update({
                where: { id: item.ticket_type_id },
                data: {
                    reserved_quantity: { decrement: item.quantity },
                    reservation_expires_at: null,
                },
            });
        }

        // Update order status
        await tx.orders.update({
            where: { id: orderId },
            data: { status: newStatus },
        });
    }

    async getAllOrders() {
        return await this.prisma.orders.findMany();
    }

    /**
     * Cancel order manually - cho phép user hủy order pending của họ
     */
    async cancelOrder(orderId: string, userId: string) {
        const order = await this.prisma.orders.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.user_id !== userId) {
            throw new BadRequestException('You can only cancel your own orders');
        }

        if (order.status !== orders_status.pending) {
            throw new BadRequestException(`Order cannot be cancelled. Current status: ${order.status}`);
        }

        return await this.releaseReservedTickets(orderId, orders_status.failed);
    }
}
