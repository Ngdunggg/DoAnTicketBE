import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { OrderModule } from '@modules/orders/order.module';
import { PurchasedTicketModule } from '@modules/purchasedTicket/purchasedTicket.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { EmailService } from '@common/services/email.service';
import { VnpayService } from '@common/services/vnpay.service';
import { MomoService } from '@common/services/momo.service';
import { ZaloPayService } from '@common/services/zalopay.service';
import vnpayConfig from '@config/vnpay.config';
import momoConfig from '@config/momo.config';
import zalopayConfig from '@config/zalopay.config';

@Module({
    imports: [
        ConfigModule.forFeature(vnpayConfig),
        ConfigModule.forFeature(momoConfig),
        ConfigModule.forFeature(zalopayConfig),
        PrismaModule, 
        OrderModule, 
        PurchasedTicketModule
    ],
    providers: [PaymentService, EmailService, VnpayService, MomoService, ZaloPayService],
    controllers: [PaymentController],
    exports: [PaymentService],
})
export class PaymentModule {}
