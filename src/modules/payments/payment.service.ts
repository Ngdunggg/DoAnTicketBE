import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { OrderService } from '@modules/orders/order.service';
import { PurchasedTicketService } from '@modules/purchasedTicket/purchasedTicket.service';
import { CreatePaymentDto, VnpayCallbackDto, MomoCallbackDto, ZaloPayCallbackDto } from '@common/dto/payment.dto';
import { payment_method, transaction_status, orders_status, purchased_tickets_status } from 'generated/prisma';
import { EmailService } from '@common/services/email.service';
import { VnpayService } from '@common/services/vnpay.service';
import { MomoService } from '@common/services/momo.service';
import { ZaloPayService } from '@common/services/zalopay.service';
import { OrderWithItems, PurchasedTicket } from '@shared/interface/payment.interface';

@Injectable()
export class PaymentService {
    constructor(
        private prisma: PrismaService,
        private orderService: OrderService,
        private purchasedTicketService: PurchasedTicketService,
        private emailService: EmailService,
        private vnpayService: VnpayService,
        private momoService: MomoService,
        private zalopayService: ZaloPayService
    ) {}

    async createPaymentUrl(createPaymentDto: CreatePaymentDto, userId: string, ipAddress: string) {
        // 1. Get order details
        const order = await this.orderService.getOrderById(createPaymentDto.order_id, userId);

        if (order.status !== orders_status.pending) {
            throw new BadRequestException('Order is not pending');
        }

        // 2. Determine payment gateway
        const paymentMethod = createPaymentDto.payment_method || payment_method.vnpay;

        // 3. Create payment transaction
        const transactionCode = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transaction = await this.prisma.payment_transactions.create({
            data: {
                order_id: order.id,
                payment_method: paymentMethod,
                transaction_code: transactionCode,
                amount: order.total_amount,
                currency: 'VND',
                status: transaction_status.pending,
                gateway_response: {},
            },
        });

        // 4. Generate payment URL based on gateway
        let paymentUrl: string;
        const paymentParams = {
            orderId: order.id,
            amount: order.total_amount.toNumber(),
            orderInfo: `Thanh toan don hang ${order.id}`,
            ipAddress,
            transactionCode,
        };

        switch (paymentMethod) {
            case payment_method.momo:
                paymentUrl = await this.momoService.generatePaymentUrl(paymentParams);
                break;
            case payment_method.zalopay:
                paymentUrl = await this.zalopayService.generatePaymentUrl(paymentParams);
                break;
            case payment_method.vnpay:
                paymentUrl = this.vnpayService.generatePaymentUrl(paymentParams);
                break;
            default:
                throw new BadRequestException('Unsupported payment gateway');
        }

        return {
            payment_url: paymentUrl,
            transaction_id: transaction.id,
            gateway: paymentMethod,
        };
    }

    async handleVnpayCallback(callbackDto: VnpayCallbackDto) {
        return this.handlePaymentCallback(
            callbackDto.vnp_TxnRef,
            callbackDto,
            () => this.vnpayService.verifyCallback(callbackDto),
            () => this.vnpayService.isPaymentSuccess(callbackDto)
        );
    }

    async handleMomoCallback(callbackDto: MomoCallbackDto) {
        const momoParams = {
            partnerCode: callbackDto.partnerCode,
            orderId: callbackDto.orderId,
            requestId: callbackDto.requestId,
            amount: parseInt(callbackDto.amount),
            orderInfo: callbackDto.orderInfo,
            orderType: callbackDto.orderType,
            transId: parseInt(callbackDto.transId),
            resultCode: parseInt(callbackDto.resultCode),
            message: callbackDto.message,
            payType: callbackDto.payType,
            responseTime: parseInt(callbackDto.responseTime),
            extraData: callbackDto.extraData,
            signature: callbackDto.signature,
        };

        return this.handlePaymentCallback(
            callbackDto.orderId,
            callbackDto,
            () => this.momoService.verifyCallback(momoParams),
            () => this.momoService.isPaymentSuccess(momoParams)
        );
    }

    /**
     * Xử lý payment từ ZaloPay return URL (giống MoMo)
     * Return URL chỉ có: appid, apptransid, amount, status, checksum
     * Cần tìm transaction và xử lý payment
     */
    async handleZaloPayReturn(query: Record<string, string>): Promise<{ success: boolean; order_id?: string }> {
        const appTransId = query.apptransid || '';
        const status = query.status || '';
        const amount = parseInt(query.amount || '0');

        if (!appTransId || status !== '1') {
            return { success: false };
        }

        // Tìm transaction pending của zalopay
        const pendingTransactions = await this.prisma.payment_transactions.findMany({
            where: {
                payment_method: payment_method.zalopay,
                status: transaction_status.pending,
            },
            include: { orders: true },
            orderBy: { created_at: 'desc' },
            take: 20,
        });

        // Tìm transaction khớp theo amount (không có item để parse)
        let matchedTransaction: (typeof pendingTransactions)[0] | null = null;

        // Match theo amount chính xác
        const exactMatches = pendingTransactions.filter((tx) => tx.amount.toNumber() === amount);

        if (exactMatches.length === 1) {
            matchedTransaction = exactMatches[0];
        } else if (exactMatches.length > 1) {
            // Nhiều transactions cùng amount -> lấy cái mới nhất và lưu app_trans_id để lần sau chính xác hơn
            matchedTransaction = exactMatches[0];
        }

        if (!matchedTransaction) {
            console.error('Không tìm thấy transaction matching với return URL');
            return { success: false };
        }

        // Kiểm tra xem transaction đã được xử lý chưa
        if (matchedTransaction.status !== transaction_status.pending) {
            return {
                success: matchedTransaction.status === transaction_status.success,
                order_id: matchedTransaction.order_id,
            };
        }

        // Process payment thành công
        try {
            await this.processSuccessfulPayment(matchedTransaction.order_id);

            // Update transaction status và lưu app_trans_id để lần sau match chính xác
            const response = matchedTransaction.gateway_response as Record<string, any>;
            await this.prisma.payment_transactions.update({
                where: { id: matchedTransaction.id },
                data: {
                    status: transaction_status.success,
                    confirmed_at: new Date(),
                    gateway_response: {
                        ...(response || {}),
                        app_trans_id: appTransId,
                        return_url_data: query,
                        processed_from_return_url: true,
                    } as Record<string, any>,
                },
            });

            return {
                success: true,
                order_id: matchedTransaction.order_id,
            };
        } catch {
            return { success: false };
        }
    }

    async handleZaloPayCallback(callbackDto: ZaloPayCallbackDto) {
        const zalopayParams = {
            app_id: callbackDto.app_id,
            app_trans_id: callbackDto.app_trans_id,
            app_time: parseInt(callbackDto.app_time),
            app_user: callbackDto.app_user,
            amount: parseInt(callbackDto.amount),
            item: callbackDto.item,
            description: callbackDto.description,
            embed_data: callbackDto.embed_data,
            zp_trans_id: parseInt(callbackDto.zp_trans_id),
            server_time: parseInt(callbackDto.server_time),
            channel: parseInt(callbackDto.channel),
            merchant_user_id: callbackDto.merchant_user_id,
            user_fee_amount: parseInt(callbackDto.user_fee_amount),
            discount_amount: parseInt(callbackDto.discount_amount),
            status: parseInt(callbackDto.status),
            mac: callbackDto.mac,
        };

        let transactionCode = callbackDto.app_trans_id; // Fallback: dùng app_trans_id nếu không parse được

        try {
            const itemData = JSON.parse(callbackDto.item) as { itemid: string }[];

            if (Array.isArray(itemData) && itemData.length > 0 && itemData[0]?.itemid) {
                transactionCode = itemData[0].itemid;
            } else {
                // fallback giữ nguyên
            }
        } catch {
            // fallback giữ nguyên
        }

        return this.handlePaymentCallback(
            transactionCode,
            callbackDto,
            () => this.zalopayService.verifyCallback(zalopayParams),
            () => this.zalopayService.isPaymentSuccess(zalopayParams)
        );
    }

    private async handlePaymentCallback(
        transactionCode: string,
        callbackData: any,
        verifyCallback: () => boolean,
        isPaymentSuccess: () => boolean
    ) {
        // 1. Verify callback signature
        const isValid = verifyCallback();
        if (!isValid) {
            throw new BadRequestException('Invalid callback signature');
        }

        // 2. Find transaction
        const transaction = await this.prisma.payment_transactions.findFirst({
            where: { transaction_code: transactionCode },
            include: { orders: true },
        });

        if (!transaction) {
            throw new NotFoundException(`Transaction not found with code: ${transactionCode}`);
        }

        // 3. Update transaction status
        const isSuccess = isPaymentSuccess();
        const newStatus = isSuccess ? transaction_status.success : transaction_status.failed;

        await this.prisma.payment_transactions.update({
            where: { id: transaction.id },
            data: {
                status: newStatus,
                gateway_response: callbackData as Record<string, any>,
                confirmed_at: isSuccess ? new Date() : null,
            },
        });

        // 4. Process payment result
        if (isSuccess) {
            await this.processSuccessfulPayment(transaction.order_id);
        } else {
            // Release reserved tickets khi payment failed
            await this.processFailedPayment(transaction.order_id);
        }

        const result = {
            success: isSuccess,
            transaction_id: transaction.id,
            order_id: transaction.order_id,
        };
        return result;
    }

    private async processSuccessfulPayment(orderId: string) {
        // Sử dụng database transaction để đảm bảo atomicity
        return await this.prisma.$transaction(
            async (tx) => {
                // 1. Get order with items (với lock để prevent race conditions)
                const order = (await tx.orders.findUnique({
                    where: { id: orderId },
                    include: {
                        order_items: {
                            include: {
                                ticket_types: {
                                    include: {
                                        events: true,
                                        event_dates: true,
                                    },
                                },
                            },
                        },
                        users: true,
                    },
                })) as OrderWithItems | null;

                if (!order) {
                    throw new NotFoundException('Order not found');
                }

                // 2. Validate order status
                if (order.status !== orders_status.pending) {
                    throw new BadRequestException(`Order is not in pending status. Current status: ${order.status}`);
                }

                // 3. Update order status to paid
                await tx.orders.update({
                    where: { id: orderId },
                    data: { status: orders_status.paid },
                });

                // 4. Create purchased tickets và update ticket quantities
                const purchasedTickets: PurchasedTicket[] = [];

                for (const item of order.order_items) {
                    // Tạo purchased tickets
                    for (let i = 0; i < item.quantity; i++) {
                        const ticket = await tx.purchased_tickets.create({
                            data: {
                                ticket_type_id: item.ticket_type_id,
                                buyer_id: order.user_id,
                                order_id: order.id,
                                event_id: item.ticket_types.event_id,
                                serial_number: `TK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                                price: item.ticket_types.price,
                                status: purchased_tickets_status.unused,
                            },
                        });
                        purchasedTickets.push(ticket);
                    }

                    // Update ticket quantities: convert reserved to purchased
                    await tx.ticket_types.update({
                        where: { id: item.ticket_type_id },
                        data: {
                            // Giảm reserved_quantity (convert reserved to purchased)
                            reserved_quantity: { decrement: item.quantity },
                            // Giảm remaining_quantity (vé đã được bán)
                            remaining_quantity: { decrement: item.quantity },
                            // Reset reservation expiry vì đã convert thành purchased
                            reservation_expires_at: null,
                        },
                    });
                }

                // Tạo map ticket_type_id -> ticket info để lấy đúng tên loại vé cho từng vé
                const ticketTypeInfoMap = new Map<
                    string,
                    {
                        ticket_type_name: string;
                        event_title: string;
                        event_date: Date;
                    }
                >();

                for (const item of order.order_items) {
                    const eventDate = item.ticket_types.event_dates
                        ? item.ticket_types.event_dates.start_at
                        : item.ticket_types.events.start_time;

                    ticketTypeInfoMap.set(item.ticket_type_id, {
                        ticket_type_name: item.ticket_types.name,
                        event_title: item.ticket_types.events.title,
                        event_date: eventDate,
                    });
                }

                // 5. Send email with QR codes (async, không block transaction)
                this.sendTicketEmail(order, purchasedTickets, ticketTypeInfoMap).catch((error) => {
                    console.error('Failed to send ticket email:', error);
                });

                return purchasedTickets;
            },
            {
                // Transaction timeout: 60 giây (payment processing cần thời gian)
                timeout: 60000,
            }
        );
    }

    /**
     * Xử lý failed payment - release reserved tickets
     */
    private async processFailedPayment(orderId: string) {
        try {
            // Release reserved tickets và update status to failed
            await this.orderService.releaseReservedTickets(orderId, orders_status.failed);
        } catch (error) {
            console.error(`Error processing failed payment for order ${orderId}:`, error);
            // Không throw error để không ảnh hưởng payment callback processing
        }
    }

    /**
     * Xử lý cancelled payment - khi user hủy thanh toán từ gateway
     */
    async cancelOrderPayment(orderId: string) {
        try {
            // Release reserved tickets và update status to failed (vì không có cancelled status)
            await this.orderService.releaseReservedTickets(orderId, orders_status.failed);

            // Update transaction status nếu có
            await this.prisma.payment_transactions.updateMany({
                where: {
                    order_id: orderId,
                    status: transaction_status.pending,
                },
                data: {
                    status: transaction_status.failed,
                },
            });

            return { success: true, order_id: orderId };
        } catch (error) {
            console.error(`Error cancelling order payment ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Cleanup pending payment transactions cùng với cleanup orders
     * Method này được gọi từ cleanup service để đảm bảo cleanup đồng bộ
     */
    async cleanupPendingTransactions() {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const result = await this.prisma.payment_transactions.updateMany({
                where: {
                    status: transaction_status.pending,
                    created_at: { lt: fifteenMinutesAgo },
                },
                data: {
                    status: transaction_status.failed,
                },
            });

            return { cleanedTransactions: result.count };
        } catch (error) {
            console.error('Error cleaning up pending transactions:', error);
            throw error;
        }
    }

    /**
     * Cancel order by transaction code - tìm order từ transaction code và cancel
     */
    async cancelOrderByTransactionCode(transactionCode: string) {
        try {
            const transaction = await this.prisma.payment_transactions.findFirst({
                where: {
                    transaction_code: transactionCode,
                    status: transaction_status.pending,
                },
            });
            if (transaction) {
                return await this.cancelOrderPayment(transaction.order_id);
            }
            return { success: false, message: 'Transaction not found or already processed' };
        } catch (error) {
            console.error(`Error cancelling order by transaction code ${transactionCode}:`, error);
            throw error;
        }
    }

    /**
     * Cancel order by ZaloPay apptransid - tìm transaction theo amount và apptransid
     */
    async cancelOrderByZaloPayAppTransId(apptransid: string, amount: number) {
        try {
            // Tìm transaction pending của zalopay
            const pendingTransactions = await this.prisma.payment_transactions.findMany({
                where: {
                    payment_method: payment_method.zalopay,
                    status: transaction_status.pending,
                },
                include: { orders: true },
                orderBy: { created_at: 'desc' },
                take: 20,
            });

            // Match theo amount và apptransid (nếu có trong gateway_response)
            let matchedTransaction = pendingTransactions.find((tx) => {
                const txAmount = tx.amount.toNumber();
                const matchesAmount = txAmount === amount;
                if (matchesAmount) {
                    const response = tx.gateway_response as Record<string, any>;
                    // Nếu có app_trans_id trong gateway_response và khớp
                    if (response?.app_trans_id === apptransid) {
                        return true;
                    }
                    // Nếu chưa có app_trans_id, match theo amount (lấy mới nhất)
                    if (!response?.app_trans_id) {
                        return true;
                    }
                }
                return false;
            });

            // Nếu không tìm thấy match với apptransid, lấy transaction mới nhất có amount khớp
            if (!matchedTransaction) {
                const exactMatches = pendingTransactions.filter((tx) => tx.amount.toNumber() === amount);
                if (exactMatches.length > 0) {
                    matchedTransaction = exactMatches[0];
                }
            }

            if (matchedTransaction) {
                return await this.cancelOrderPayment(matchedTransaction.order_id);
            }
            return { success: false, message: 'Transaction not found or already processed' };
        } catch (error) {
            console.error(`Error cancelling order by ZaloPay apptransid ${apptransid}:`, error);
            throw error;
        }
    }

    private async sendTicketEmail(
        order: OrderWithItems,
        tickets: PurchasedTicket[],
        ticketTypeInfoMap: Map<
            string,
            {
                ticket_type_name: string;
                event_title: string;
                event_date: Date;
            }
        >
    ) {
        const qrCodes = tickets.map((ticket) => {
            const ticketInfo = ticketTypeInfoMap.get(ticket.ticket_type_id);

            const qrData = JSON.stringify({
                eventId: ticket.event_id,
                serialNumber: ticket.serial_number,
                ticketId: ticket.id,
            });

            return {
                id: ticket.id,
                serial_number: ticket.serial_number,
                qr_data: qrData,
                event_title: ticketInfo?.event_title || '',
                event_date: ticketInfo?.event_date || new Date(),
                ticket_type_name: ticketInfo?.ticket_type_name || '',
            };
        });

        await this.emailService.sendTicketConfirmation({
            to: order.buyer_email,
            buyer_name: order.users.full_name,
            order_id: order.id,
            tickets: qrCodes,
        });
    }
}
