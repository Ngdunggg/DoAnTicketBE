import { registerAs } from '@nestjs/config';

export interface ZaloPayConfig {
    appId: string;
    key1: string;
    key2: string;
    environment: string;
    endpoint: string;
    returnUrl: string;
    callbackUrl: string;
}
export default registerAs('zalopay', () => ({
    appId: process.env.ZALOPAY_APP_ID || 'DEMO_APP_ID',
    key1: process.env.ZALOPAY_KEY1 || 'DEMO_KEY1',
    key2: process.env.ZALOPAY_KEY2 || 'DEMO_KEY2',
    environment: process.env.ZALOPAY_ENVIRONMENT || 'sandbox', // sandbox | production
    endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
    returnUrl: process.env.ZALOPAY_RETURN_URL || 'http://localhost:5000/payments/zalopay-return',
    callbackUrl: process.env.ZALOPAY_CALLBACK_URL || 'http://localhost:5000/payments/zalopay-callback',
}));
