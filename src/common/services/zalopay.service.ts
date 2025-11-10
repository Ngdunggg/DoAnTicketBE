import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ZaloPayConfig } from '@config/zalopay.config';
import axios from 'axios';

export interface ZaloPayApiResponse {
    return_code: number;
    return_message: string;
    order_url: string;
}

export interface ZaloPayPaymentParams {
    orderId: string;
    amount: number;
    orderInfo: string;
    ipAddress: string;
    transactionCode: string;
}

export interface ZaloPayCallbackParams {
    app_id: string;
    app_trans_id: string;
    app_time: number;
    app_user: string;
    amount: number;
    item: string;
    description: string;
    embed_data: string;
    zp_trans_id: number;
    server_time: number;
    channel: number;
    merchant_user_id: string;
    user_fee_amount: number;
    discount_amount: number;
    status: number;
    mac: string;
}

@Injectable()
export class ZaloPayService {
    private readonly config: ZaloPayConfig;

    constructor(private configService: ConfigService) {
        this.config = this.configService.get<ZaloPayConfig>('zalopay')!;
        this.validateConfig();
    }

    /**
     * Xác thực chữ ký cho RETURN URL (người dùng quay về) của ZaloPay.
     * Param names: appid, apptransid, pmcid, bankcode, amount, discountamount, status
     * checksum = HMAC_SHA256(key2, `${appid}|${apptransid}|${pmcid}|${bankcode}|${amount}|${discountamount}|${status}`)
     */
    verifyReturnSignature(query: Record<string, string>): boolean {
        try {
            const appid = query.appid || '';
            const apptransid = query.apptransid || '';
            const pmcid = query.pmcid || '';
            const bankcode = query.bankcode || '';
            const amount = query.amount || '';
            const discountamount = query.discountamount || '';
            const status = query.status || '';
            const checksum = query.checksum || '';

            const data = `${appid}|${apptransid}|${pmcid}|${bankcode}|${amount}|${discountamount}|${status}`;
            const expected = crypto.createHmac('sha256', this.config.key2).update(data).digest('hex');
            return expected === checksum;
        } catch (e) {
            console.error('Error verifying ZaloPay return signature:', e);
            return false;
        }
    }

    private validateConfig() {
        const requiredFields = ['appId', 'key1', 'key2', 'endpoint'];
        const missingFields = requiredFields.filter((field) => !this.config[field]);

        if (missingFields.length > 0) {
            console.warn(`Missing ZaloPay configuration: ${missingFields.join(', ')}. Using demo values.`);
            // Tạm thời sử dụng demo values thay vì throw error
            this.config.appId = this.config.appId || 'DEMO_APP_ID';
            this.config.key1 = this.config.key1 || 'DEMO_KEY1';
            this.config.key2 = this.config.key2 || 'DEMO_KEY2';
            this.config.endpoint = this.config.endpoint || 'https://sb-openapi.zalopay.vn/v2/create';
        }
    }

    async generatePaymentUrl(params: ZaloPayPaymentParams): Promise<string> {
        const appTime = Date.now();
        const transID = Math.floor(Math.random() * 1000000); // Generate random number
        const appTransId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${transID}`; // Format: YYMMDD_transID

        const order = {
            app_id: this.config.appId,
            app_user: 'TicketSystem',
            app_time: appTime,
            amount: params.amount,
            app_trans_id: appTransId,
            description: params.orderInfo,
            item: JSON.stringify([
                {
                    itemid: params.transactionCode,
                    itemname: params.orderInfo,
                    itemprice: params.amount,
                    itemquantity: 1,
                },
            ]),
            embed_data: JSON.stringify({
                redirecturl: this.config.returnUrl,
            }),
            bank_code: '',
        };

        const data = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
        const mac = crypto.createHmac('sha256', this.config.key1).update(data).digest('hex');

        order['mac'] = mac;

        try {
            // Send as query params like demo
            const response = await axios.post(this.config.endpoint, null, {
                params: order,
            });

            const result = response.data as ZaloPayApiResponse;

            if (result.return_code === 1) {
                return result.order_url || '';
            } else {
                // Log lỗi chi tiết trước khi throw
                throw new Error(
                    `ZaloPay payment creation failed: ${result.return_message || 'Unknown error'} (code: ${result.return_code})`
                );
            }
        } catch (error) {
            // Log chi tiết lỗi từ ZaloPay
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Failed to create ZaloPay payment: ${JSON.stringify(error.response?.data || error.message)}`
                );
            }
            // Re-throw error để payment service có thể catch và fallback
            throw error;
        }
    }

    verifyCallback(callbackParams: ZaloPayCallbackParams): boolean {
        try {
            const data = `${callbackParams.app_id}|${callbackParams.app_trans_id}|${callbackParams.app_user}|${callbackParams.amount}|${callbackParams.app_time}|${callbackParams.embed_data}|${callbackParams.item}`;
            const expectedMac = crypto.createHmac('sha256', this.config.key1).update(data).digest('hex');

            return expectedMac === callbackParams.mac;
        } catch (error) {
            console.error('Error verifying ZaloPay callback:', error);
            return false;
        }
    }

    isPaymentSuccess(callbackParams: ZaloPayCallbackParams): boolean {
        return callbackParams.status === 1;
    }
}
