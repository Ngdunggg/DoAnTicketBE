import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { CategoryModule } from '@modules/categories/category.module';
import { OrganizerModule } from '@modules/organizers/organizer.module';
import { TicketModule } from '@modules/tickets/ticket.module';
import { UserModule } from '@modules/users/user.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventViewControlMiddleware } from '@common/middlewares/event-view-control.middleware';
import { AdminGuard } from '@common/guards/admin.guard';
import { CloudinaryService } from '@common/services/cloudinary.service';
import { ROUTES } from '@shared/constants/routers';
import { OrderModule } from '../orders/order.module';
import { OrderService } from '../orders/order.service';

@Module({
    imports: [
        PrismaModule,
        CategoryModule,
        OrganizerModule,
        TicketModule,
        UserModule,
        OrderModule,
    ],
    providers: [EventService, AdminGuard, CloudinaryService, OrderService],
    controllers: [EventController],
    exports: [EventService],
})
export class EventModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(EventViewControlMiddleware).forRoutes(ROUTES.GET_EVENT_BY_ID);
    }
}
