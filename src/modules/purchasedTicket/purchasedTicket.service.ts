import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prismas.service';
import { EventService } from '../events/event.service';
import { purchased_tickets_status } from 'generated/prisma';

@Injectable()
export class PurchasedTicketService {
    constructor(
        private prisma: PrismaService,
        private eventService: EventService
    ) {}

    async getTicketsByUserId(userId: string) {
        const tickets = await this.prisma.purchased_tickets.findMany({
            where: { buyer_id: userId },
            include: {
                ticket_types: true,
                event_dates: true,
            },
        });

        if (!tickets) {
            return {
                tickets: [],
                eventInfo: [],
            };
        }

        const eventInfo = await this.eventService.getEventsByIds(tickets.map((ticket) => ticket.ticket_types.event_id));
        return {
            ticket_items: tickets,
            event_items: eventInfo,
        };
    }

    async getTicketsByEventId(eventId: string) {
        const tickets = await this.prisma.purchased_tickets.findMany({
            where: {
                event_id: eventId,
            },
            include: {
                ticket_types: true,
                event_dates: true,
            },
        });

        if (!tickets) {
            return {
                ticket_items: [],
                event_items: [],
            };
        }

        const eventInfo = await this.eventService.getEventById(eventId);

        return {
            ticket_items: tickets,
            event_items: eventInfo,
        };
    }

    async getTicketById(ticketId: string) {
        const ticket = await this.prisma.purchased_tickets.findUnique({
            where: { id: ticketId },
            include: {
                ticket_types: true,
                event_dates: true,
            },
        });

        if (!ticket) {
            return {
                ticket_item: null,
                event_items: [],
            };
        }

        const eventInfo = await this.eventService.getEventById(ticket.ticket_types.event_id);

        return {
            ticket_item: ticket,
            event_items: eventInfo,
        };
    }

    async getAllPurchasedTickets() {
        const purchasedTickets = await this.prisma.purchased_tickets.findMany();
        return purchasedTickets;
    }

    async checkInTicket(ticketId: string, status: purchased_tickets_status) {
        const ticket = await this.prisma.purchased_tickets.findUnique({
            where: { id: ticketId },
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        if (ticket.status !== purchased_tickets_status.unused) {
            throw new Error('Ticket already checked in');
        }

        await this.prisma.purchased_tickets.update({
            where: { id: ticketId },
            data: { status, check_in_at: new Date() },
        });
        return {
            message: 'Xuất vé thành công',
        };
    }
}
