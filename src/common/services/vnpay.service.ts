import { VnpayConfig } from '@config/vnpay.config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';

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
        // Convert IPv6 localhost to IPv4 (VNPay may not accept IPv6)
        let ipAddress = params.ipAddress;
        if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
            ipAddress = '127.0.0.1';
        }
        // Extract IPv4 from IPv6-mapped IPv4 address
        if (ipAddress.startsWith('::ffff:')) {
            ipAddress = ipAddress.replace('::ffff:', '');
        }

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
            vnp_IpAddr: ipAddress,
            vnp_CreateDate: this.formatDate(new Date()),
        };

        // Sort parameters alphabetically (using VNPay's sortObject method)
        const sortedParams = this.sortObject(vnpParams);

        // Create query string WITHOUT encoding (for hash generation) - using qs.stringify with encode: false
        const signData = qs.stringify(sortedParams, { encode: false });

        // Generate secure hash using Buffer (as per VNPay example)
        const secureHash = this.generateSecureHash(signData);

        // Add secure hash to params
        sortedParams['vnp_SecureHash'] = secureHash;

        // Create final URL using qs.stringify with encode: false
        const finalQueryString = qs.stringify(sortedParams, { encode: false });

        // Return full payment URL
        return `${this.config.url}?${finalQueryString}`;
    }

    verifyCallback(callbackParams: VnpayCallbackParams): boolean {
        try {
            // Extract secure hash
            const { vnp_SecureHash, ...params } = callbackParams;

            // Sort parameters alphabetically (using VNPay's sortObject method)
            const sortedParams = this.sortObject(params as Record<string, string>);

            // Create query string WITHOUT encoding (for hash verification) - using qs.stringify with encode: false
            const signData = qs.stringify(sortedParams, { encode: false });

            // Generate secure hash using Buffer (as per VNPay example)
            const expectedHash = this.generateSecureHash(signData);

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
        // VNPay's sortObject implementation - encode keys and values, replace %20 with +
        // This matches the exact implementation from VNPay example
        const sorted: Record<string, string> = {};
        const str: string[] = [];

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                str.push(encodeURIComponent(key));
            }
        }

        str.sort();

        for (let i = 0; i < str.length; i++) {
            const decodedKey = decodeURIComponent(str[i]);
            if (obj[decodedKey] !== undefined && obj[decodedKey] !== null && obj[decodedKey] !== '') {
                sorted[str[i]] = encodeURIComponent(String(obj[decodedKey])).replace(/%20/g, '+');
            }
        }

        return sorted;
    }

    private generateSecureHash(signData: string): string {
        // Use Buffer as per VNPay example
        const hmac = crypto.createHmac('sha512', this.config.secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
        return signed;
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
