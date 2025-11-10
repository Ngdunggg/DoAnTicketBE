import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { CreateTicketDto } from '@common/dto/ticket.dto';

@Injectable()
export class TicketService {
    constructor(private prisma: PrismaService) {}

    async createTicketsForEvent(eventId: string, tickets: CreateTicketDto[]) {
        return this.prisma.ticket_types.createMany({
            data: tickets.map((ticket) => ({
                event_id: eventId,
                name: ticket.name,
                price: ticket.price,
                initial_quantity: ticket.initial_quantity,
                remaining_quantity: ticket.initial_quantity, // Ban đầu = initial_quantity
                status: ticket.status,
                description: ticket.description,
            })),
        });
    }
}
