import { registerAs } from '@nestjs/config';

export interface VnpayConfig {
    tmnCode: string;
    secretKey: string;
    url: string;
    returnUrl: string;
    version: string;
    command: string;
    locale: string;
    currency: string;
    orderType: string;
}

export default registerAs('vnpay', () => ({
    tmnCode: process.env.VNPAY_TMN_CODE || '',
    secretKey: process.env.VNPAY_SECRET_KEY || '',
    url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5000/payments/vnpay-return',
    version: '2.1.0',
    command: 'pay',
    locale: 'vn',
    currency: 'VND',
    orderType: 'other',
}));
