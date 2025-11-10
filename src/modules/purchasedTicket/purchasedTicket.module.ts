import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { EventModule } from '@modules/events/event.module';
import { PurchasedTicketService } from './purchasedTicket.service';
import { PurchasedTicketController } from './purchasedTicket.controller';

@Module({
    imports: [PrismaModule, EventModule],
    providers: [PurchasedTicketService],
    controllers: [PurchasedTicketController],
    exports: [PurchasedTicketService],
})
export class PurchasedTicketModule {}
