import { Controller, Post, Get, Body, Req, Query, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, VnpayCallbackDto, MomoCallbackDto, ZaloPayCallbackDto } from '@common/dto/payment.dto';
import { Public } from '@common/decorators/public.decorator';
import type { Request, Response } from 'express';

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @Post('create-url')
    async createPaymentUrl(@Body() createPaymentDto: CreatePaymentDto, @Req() req: Request) {
        const userId = req.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const ipAddress =
            (req.headers['x-forwarded-for'] as string) ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            '127.0.0.1';

        return await this.paymentService.createPaymentUrl(createPaymentDto, userId, ipAddress);
    }

    @Public()
    @Get('vnpay-return')
    async handleVnpayReturn(@Query() query: Record<string, string>, @Res() res: Response) {
        const callbackDto: VnpayCallbackDto = {
            vnp_Amount: query.vnp_Amount || '',
            vnp_BankCode: query.vnp_BankCode || '',
            vnp_BankTranNo: query.vnp_BankTranNo || '',
            vnp_CardType: query.vnp_CardType || '',
            vnp_OrderInfo: query.vnp_OrderInfo || '',
            vnp_PayDate: query.vnp_PayDate || '',
            vnp_ResponseCode: query.vnp_ResponseCode || '',
            vnp_TmnCode: query.vnp_TmnCode || '',
            vnp_TransactionNo: query.vnp_TransactionNo || '',
            vnp_TransactionStatus: query.vnp_TransactionStatus || '',
            vnp_TxnRef: query.vnp_TxnRef || '',
            vnp_SecureHash: query.vnp_SecureHash || '',
        };

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Check status trước: nếu ResponseCode khác '00' thì là failed
        const isPaymentSuccess = callbackDto.vnp_ResponseCode === '00';

        try {
            if (isPaymentSuccess) {
                // Xử lý callback khi payment success
                const result = await this.paymentService.handleVnpayCallback(callbackDto);
                res.redirect(`${frontendUrl}/payment/result?status=success&orderId=${result.order_id}`);
            } else {
                // Payment failed - cancel order
                if (callbackDto.vnp_TxnRef) {
                    try {
                        await this.paymentService.cancelOrderByTransactionCode(callbackDto.vnp_TxnRef);
                    } catch {
                        // Ignore error nếu không tìm thấy
                    }
                }
                res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${callbackDto.vnp_TxnRef || ''}`);
            }
        } catch {
            // Nếu có lỗi khi xử lý, thử cancel order từ transaction code
            if (callbackDto.vnp_TxnRef) {
                try {
                    await this.paymentService.cancelOrderByTransactionCode(callbackDto.vnp_TxnRef);
                } catch {
                    // Ignore error nếu không tìm thấy
                }
            }
            res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${callbackDto.vnp_TxnRef || ''}`);
        }
    }

    @Public()
    @Get('momo-return')
    async handleMomoReturn(@Query() query: Record<string, string>, @Res() res: Response) {
        const callbackDto: MomoCallbackDto = {
            partnerCode: query.partnerCode || '',
            orderId: query.orderId || '',
            requestId: query.requestId || '',
            amount: query.amount || '',
            orderInfo: query.orderInfo || '',
            orderType: query.orderType || '',
            transId: query.transId || '',
            resultCode: query.resultCode || '',
            message: query.message || '',
            payType: query.payType || '',
            responseTime: query.responseTime || '',
            extraData: query.extraData || '',
            signature: query.signature || '',
        };

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Check status trước: nếu resultCode khác '0' thì là failed
        const isPaymentSuccess = callbackDto.resultCode === '0';

        try {
            if (isPaymentSuccess) {
                // Xử lý callback khi payment success
                const result = await this.paymentService.handleMomoCallback(callbackDto);
                res.redirect(`${frontendUrl}/payment/result?status=success&orderId=${result.order_id}`);
            } else {
                // Payment failed - cancel order
                if (callbackDto.orderId) {
                    try {
                        await this.paymentService.cancelOrderPayment(callbackDto.orderId);
                    } catch {
                        // Ignore error nếu không tìm thấy
                    }
                }
                res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${callbackDto.orderId || ''}`);
            }
        } catch {
            // Nếu có lỗi khi xử lý, thử cancel order từ orderId
            if (callbackDto.orderId) {
                try {
                    await this.paymentService.cancelOrderPayment(callbackDto.orderId);
                } catch {
                    // Ignore error nếu không tìm thấy
                }
            }
            res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${callbackDto.orderId || ''}`);
        }
    }

    @Public()
    @Post('momo-notify')
    async handleMomoNotify(@Body() callbackDto: MomoCallbackDto) {
        const result = await this.paymentService.handleMomoCallback(callbackDto);

        // Trả về response cho MoMo server
        return {
            errorCode: 0,
            message: 'Success',
            data: result,
        };
    }

    @Public()
    @Get('zalo-return')
    async handleZaloPayReturn(@Query() query: Record<string, string>, @Res() res: Response) {
        // Verify return signature (dùng key2)
        const isValid = this.paymentService['zalopayService'].verifyReturnSignature(query);
        const success = isValid && query.status === '1';

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        if (success) {
            try {
                const result = await this.paymentService.handleZaloPayReturn(query);
                res.redirect(
                    `${frontendUrl}/payment/result?status=${result.success ? 'success' : 'failed'}&orderId=${result.order_id || query.apptransid || ''}`
                );
            } catch {
                res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${query.apptransid || ''}`);
            }
        } else {
            // Payment failed or cancelled - try to cancel order
            try {
                const amount = parseInt(query.amount || '0');
                await this.paymentService.cancelOrderByZaloPayAppTransId(query.apptransid || '', amount);
            } catch {
                // Ignore error nếu không tìm thấy
            }
            res.redirect(`${frontendUrl}/payment/result?status=failed&orderId=${query.apptransid || ''}`);
        }
    }

    @Public()
    @Post('zalopay-callback')
    async handleZaloPayCallback(@Body() callbackDto: ZaloPayCallbackDto) {
        try {
            const result = await this.paymentService.handleZaloPayCallback(callbackDto);

            return {
                return_code: 1,
                return_message: 'Success',
                data: result,
            };
        } catch (error) {
            return {
                return_code: -1,
                return_message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
