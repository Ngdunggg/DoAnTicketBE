import { registerAs } from '@nestjs/config';

export interface MomoConfig {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    environment: string;
    endpoint: string;
    returnUrl: string;
    notifyUrl: string;
}

export default registerAs('momo', (): MomoConfig => ({
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO_DEMO',
    accessKey: process.env.MOMO_ACCESS_KEY || 'DEMO_ACCESS_KEY',
    secretKey: process.env.MOMO_SECRET_KEY || 'DEMO_SECRET_KEY',
    environment: process.env.MOMO_ENVIRONMENT || 'sandbox', // sandbox | production
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    returnUrl: process.env.MOMO_RETURN_URL || 'http://localhost:5000/payments/momo-return',
    notifyUrl: process.env.MOMO_NOTIFY_URL || 'http://localhost:5000/payments/momo-notify',
}));
