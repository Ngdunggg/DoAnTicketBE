import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
    imports: [PrismaModule],
    providers: [OrderService],
    controllers: [OrderController],
    exports: [OrderService],
})
export class OrderModule {}
