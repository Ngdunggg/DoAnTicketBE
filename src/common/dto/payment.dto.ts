import { IsString, IsEnum, IsOptional } from 'class-validator';
import { payment_method } from 'generated/prisma';

export class CreatePaymentDto {
    @IsString()
    order_id: string;

    @IsEnum(payment_method)
    @IsOptional()
    payment_method?: payment_method;
}

export class CompleteFreeOrderDto {
    @IsString()
    order_id: string;
}

export class VnpayCallbackDto {
    @IsString()
    vnp_Amount: string;

    @IsString()
    vnp_BankCode: string;

    @IsString()
    vnp_BankTranNo: string;

    @IsString()
    vnp_CardType: string;

    @IsString()
    vnp_OrderInfo: string;

    @IsString()
    vnp_PayDate: string;

    @IsString()
    vnp_ResponseCode: string;

    @IsString()
    vnp_TmnCode: string;

    @IsString()
    vnp_TransactionNo: string;

    @IsString()
    vnp_TransactionStatus: string;

    @IsString()
    vnp_TxnRef: string;

    @IsString()
    vnp_SecureHash: string;
}

export class MomoCallbackDto {
    @IsString()
    partnerCode: string;

    @IsString()
    orderId: string;

    @IsString()
    requestId: string;

    @IsString()
    amount: string;

    @IsString()
    orderInfo: string;

    @IsString()
    orderType: string;

    @IsString()
    transId: string;

    @IsString()
    resultCode: string;

    @IsString()
    message: string;

    @IsString()
    payType: string;

    @IsString()
    responseTime: string;

    @IsString()
    extraData: string;

    @IsString()
    signature: string;
}

export class ZaloPayCallbackDto {
    @IsString()
    app_id: string;

    @IsString()
    app_trans_id: string;

    @IsString()
    app_time: string;

    @IsString()
    app_user: string;

    @IsString()
    amount: string;

    @IsString()
    item: string;

    @IsString()
    description: string;

    @IsString()
    embed_data: string;

    @IsString()
    zp_trans_id: string;

    @IsString()
    server_time: string;

    @IsString()
    channel: string;

    @IsString()
    merchant_user_id: string;

    @IsString()
    user_fee_amount: string;

    @IsString()
    discount_amount: string;

    @IsString()
    status: string;

    @IsString()
    mac: string;
}
