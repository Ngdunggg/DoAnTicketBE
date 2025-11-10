import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { TicketService } from './ticket.service';

@Module({
    imports: [PrismaModule],
    providers: [TicketService],
    exports: [TicketService],
})
export class TicketModule {}
