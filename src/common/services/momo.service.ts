import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MomoConfig } from '@config/momo.config';
import axios from 'axios';

/**
 * Tham số để tạo URL thanh toán Momo
 */
export interface MomoPaymentParams {
    orderId: string; // ID đơn hàng của hệ thống
    amount: number; // Số tiền thanh toán (VND)
    orderInfo: string; // Mô tả đơn hàng
    ipAddress: string; // IP của người dùng
    transactionCode: string; // Mã giao dịch unique
}

/**
 * Tham số callback từ Momo sau khi thanh toán
 */
export interface MomoCallbackParams {
    partnerCode: string; // Mã đối tác Momo
    orderId: string; // ID đơn hàng
    requestId: string; // ID request
    amount: number; // Số tiền đã thanh toán
    orderInfo: string; // Thông tin đơn hàng
    orderType: string; // Loại đơn hàng
    transId: number; // ID giao dịch Momo
    resultCode: number; // Mã kết quả (0 = thành công)
    message: string; // Thông báo
    payType: string; // Phương thức thanh toán
    responseTime: number; // Thời gian phản hồi
    extraData: string; // Dữ liệu thêm
    signature: string; // Chữ ký xác thực
}

export interface MomoApiResponse {
    resultCode: number;
    message: string;
    payUrl?: string;
}

/**
 * Service xử lý thanh toán qua Momo
 *
 * Cách hoạt động:
 * 1. Tạo URL thanh toán -> User thanh toán trên Momo
 * 2. Momo gửi callback về hệ thống
 * 3. Xác thực callback và cập nhật trạng thái đơn hàng
 */
@Injectable()
export class MomoService {
    private readonly config: MomoConfig;

    constructor(private configService: ConfigService) {
        // Lấy config Momo từ environment variables
        this.config = this.configService.get<MomoConfig>('momo')!;
        this.validateConfig();
    }

    /**
     * Kiểm tra config Momo có đầy đủ không
     */
    private validateConfig() {
        const requiredFields = ['partnerCode', 'accessKey', 'secretKey', 'endpoint'];
        const missingFields = requiredFields.filter((field) => !this.config[field]);

        if (missingFields.length > 0) {
            console.warn(`Missing Momo configuration: ${missingFields.join(', ')}. Using demo values.`);
            // Tạm thời sử dụng demo values thay vì throw error
            this.config.partnerCode = this.config.partnerCode || 'MOMO_DEMO';
            this.config.accessKey = this.config.accessKey || 'DEMO_ACCESS_KEY';
            this.config.secretKey = this.config.secretKey || 'DEMO_SECRET_KEY';
            this.config.endpoint = this.config.endpoint || 'https://test-payment.momo.vn/v2/gateway/api/create';
        }
    }

    /**
     * Tạo URL thanh toán Momo
     *
     * Quy trình:
     * 1. Tạo requestId unique
     * 2. Tạo chữ ký (signature) để bảo mật
     * 3. Gửi request đến Momo API
     * 4. Nhận về URL thanh toán
     */
    async generatePaymentUrl(params: MomoPaymentParams): Promise<string> {
        // 1. Tạo requestId unique cho mỗi request
        const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 2. Tạo chuỗi để ký (theo format Momo yêu cầu)
        const rawSignature = `accessKey=${this.config.accessKey}&amount=${params.amount}&extraData=&ipnUrl=${this.config.notifyUrl}&orderId=${params.transactionCode}&orderInfo=${params.orderInfo}&partnerCode=${this.config.partnerCode}&redirectUrl=${this.config.returnUrl}&requestId=${requestId}&requestType=payWithMethod`;

        // 3. Tạo chữ ký HMAC-SHA256
        const signature = crypto.createHmac('sha256', this.config.secretKey).update(rawSignature).digest('hex');

        // 4. Tạo request body gửi đến Momo
        const requestBody = {
            partnerCode: this.config.partnerCode,
            accessKey: this.config.accessKey,
            requestId: requestId,
            amount: params.amount,
            orderId: params.transactionCode,
            orderInfo: params.orderInfo,
            redirectUrl: this.config.returnUrl,
            ipnUrl: this.config.notifyUrl,
            extraData: '',
            requestType: 'payWithMethod',
            signature: signature,
            lang: 'vi',
        };

        try {
            // 5. Gửi request đến Momo API
            const response = await axios.post(this.config.endpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = response.data as MomoApiResponse;

            // 6. Kiểm tra kết quả
            if (result.resultCode === 0) {
                // Thành công -> trả về URL thanh toán từ Momo
                return result.payUrl || '';
            } else {
                // Thất bại -> throw error
                throw new Error(`Momo payment creation failed: ${result.message}`);
            }
        } catch (error) {
            // Log chi tiết lỗi từ Momo
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Failed to create Momo payment: ${JSON.stringify(error.response?.data || error.message)}`
                );
            }
            throw new Error(
                `Failed to create Momo payment: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Xác thực callback từ Momo
     *
     * Quy trình:
     * 1. Tạo lại chữ ký từ dữ liệu callback
     * 2. So sánh với chữ ký Momo gửi về
     * 3. Trả về true nếu khớp (đảm bảo dữ liệu không bị giả mạo)
     */
    verifyCallback(callbackParams: MomoCallbackParams): boolean {
        try {
            // 1. Tạo chuỗi để ký từ dữ liệu callback (theo format Momo)
            const rawSignature = `accessKey=${this.config.accessKey}&amount=${callbackParams.amount}&extraData=${callbackParams.extraData}&message=${callbackParams.message}&orderId=${callbackParams.orderId}&orderInfo=${callbackParams.orderInfo}&orderType=${callbackParams.orderType}&partnerCode=${callbackParams.partnerCode}&payType=${callbackParams.payType}&requestId=${callbackParams.requestId}&responseTime=${callbackParams.responseTime}&resultCode=${callbackParams.resultCode}&transId=${callbackParams.transId}`;

            // 2. Tạo chữ ký từ chuỗi trên
            const expectedSignature = crypto
                .createHmac('sha256', this.config.secretKey)
                .update(rawSignature)
                .digest('hex');

            // 3. So sánh chữ ký
            return expectedSignature === callbackParams.signature;
        } catch (error) {
            console.error('Error verifying Momo callback:', error);
            return false;
        }
    }

    /**
     * Kiểm tra thanh toán có thành công không
     *
     * Momo trả về resultCode:
     * - 0: Thành công
     * - Khác 0: Thất bại
     */
    isPaymentSuccess(callbackParams: MomoCallbackParams): boolean {
        return callbackParams.resultCode === 0;
    }
}
