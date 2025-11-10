import { VnpayConfig } from '@config/vnpay.config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface VnpayPaymentParams {
    orderId: string;
    amount: number;
    orderInfo: string;
    ipAddress: string;
    transactionCode: string;
}

export interface VnpayCallbackParams {
    vnp_Amount: string;
    vnp_BankCode: string;
    vnp_BankTranNo: string;
    vnp_CardType: string;
    vnp_OrderInfo: string;
    vnp_PayDate: string;
    vnp_ResponseCode: string;
    vnp_TmnCode: string;
    vnp_TransactionNo: string;
    vnp_TransactionStatus: string;
    vnp_TxnRef: string;
    vnp_SecureHash: string;
    vnp_SecureHashType?: string;
}

@Injectable()
export class VnpayService {
    private readonly config: VnpayConfig;

    constructor(private configService: ConfigService) {
        this.config = this.configService.get<VnpayConfig>('vnpay')!;
        this.validateConfig();
    }

    private validateConfig() {
        const requiredFields = ['tmnCode', 'secretKey', 'url', 'returnUrl'];
        const missingFields = requiredFields.filter((field) => !this.config[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing VNPay configuration: ${missingFields.join(', ')}`);
        }
    }

    generatePaymentUrl(params: VnpayPaymentParams): string {
        const vnpParams: Record<string, string> = {
            vnp_Version: this.config.version,
            vnp_Command: this.config.command,
            vnp_TmnCode: this.config.tmnCode,
            vnp_Locale: this.config.locale,
            vnp_CurrCode: this.config.currency,
            vnp_TxnRef: params.transactionCode,
            vnp_OrderInfo: params.orderInfo,
            vnp_OrderType: this.config.orderType,
            vnp_Amount: (params.amount * 100).toString(), // VNPay expects amount in cents
            vnp_ReturnUrl: this.config.returnUrl,
            vnp_IpAddr: params.ipAddress,
            vnp_CreateDate: this.formatDate(new Date()),
        };

        // Sort parameters alphabetically
        const sortedParams = this.sortObject(vnpParams);

        // Create query string
        const queryString = this.createQueryString(sortedParams);

        // Generate secure hash
        const secureHash = this.generateSecureHash(queryString);

        // Return full payment URL
        return `${this.config.url}?${queryString}&vnp_SecureHash=${secureHash}`;
    }

    verifyCallback(callbackParams: VnpayCallbackParams): boolean {
        try {
            // Extract secure hash
            const { vnp_SecureHash, ...params } = callbackParams;

            // Sort parameters alphabetically
            const sortedParams = this.sortObject(params);

            // Create query string
            const queryString = this.createQueryString(sortedParams);

            // Generate secure hash
            const expectedHash = this.generateSecureHash(queryString);

            // Compare hashes
            return expectedHash === vnp_SecureHash;
        } catch (error) {
            console.error('Error verifying VNPay callback:', error);
            return false;
        }
    }

    isPaymentSuccess(callbackParams: VnpayCallbackParams): boolean {
        return callbackParams.vnp_ResponseCode === '00';
    }

    private sortObject(obj: Record<string, any>): Record<string, string> {
        const sorted: Record<string, string> = {};
        const keys = Object.keys(obj).sort();

        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) {
                sorted[key] = String(obj[key]);
            }
        }

        return sorted;
    }

    private createQueryString(params: Record<string, string>): string {
        return Object.keys(params)
            .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
    }

    private generateSecureHash(queryString: string): string {
        return crypto.createHmac('sha512', this.config.secretKey).update(queryString).digest('hex');
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
}
