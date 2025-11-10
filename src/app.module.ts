import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { UserModule } from '@modules/users/user.module';
import { AuthModule } from '@modules/auth/auth.module';
import { EventModule } from '@modules/events/event.module';
import { CategoryModule } from '@modules/categories/category.module';
import { PurchasedTicketModule } from '@modules/purchasedTicket/purchasedTicket.module';
import { OrderModule } from '@modules/orders/order.module';
import { PaymentModule } from '@modules/payments/payment.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { JwtCookieGuard } from '@common/guards/jwt-cookie.guard';
import { CleanupService } from '@common/services/cleanup.service';
import jwtConfig from '@config/jwt.config';
import { UploadsModule } from '@modules/uploads/uploads.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ConfigModule.forFeature(jwtConfig),
        ScheduleModule.forRoot(), // Enable cron jobs
        UserModule,
        PrismaModule,
        AuthModule,
        EventModule,
        CategoryModule,
        PurchasedTicketModule,
        OrderModule,
        PaymentModule,
        UploadsModule,
    ],
    controllers: [],
    providers: [
        CleanupService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
        {
            provide: APP_GUARD,
            useClass: JwtCookieGuard,
        },
    ],
})
export class AppModule {}
