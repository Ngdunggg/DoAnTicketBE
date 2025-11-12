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

    /**
     * Get tickets that should be expired (for debugging)
     */
    async getTicketsToExpire() {
        const now = new Date();

        // Find tickets with event_date_id where event_dates.end_at < now
        const ticketsWithEventDate = await this.prisma.purchased_tickets.findMany({
            where: {
                status: purchased_tickets_status.unused,
                event_date_id: { not: null },
                event_dates: {
                    end_at: { lt: now },
                },
            },
            include: {
                events: {
                    select: {
                        id: true,
                        title: true,
                        end_time: true,
                    },
                },
                event_dates: {
                    select: {
                        id: true,
                        end_at: true,
                    },
                },
            },
        });

        // Find tickets without event_date_id where events.end_time < now
        const ticketsWithoutEventDate = await this.prisma.purchased_tickets.findMany({
            where: {
                status: purchased_tickets_status.unused,
                event_date_id: null,
                events: {
                    end_time: { lt: now },
                },
            },
            include: {
                events: {
                    select: {
                        id: true,
                        title: true,
                        end_time: true,
                    },
                },
            },
        });

        return {
            withEventDate: ticketsWithEventDate,
            withoutEventDate: ticketsWithoutEventDate,
            total: ticketsWithEventDate.length + ticketsWithoutEventDate.length,
        };
    }

    /**
     * Expire tickets for ended events
     * This method will be called by cron job to automatically expire tickets
     * when their associated events have ended
     * 
     * Logic:
     * 1. Find tickets with event_date_id where event_dates.end_at < now
     * 2. Find tickets without event_date_id where events.end_time < now
     * 3. Update status to 'expired' for all found tickets
     */
    async expireTicketsForEndedEvents() {
        const now = new Date();

        // First, find tickets with event_date_id where event_dates.end_at < now
        const ticketsWithEventDate = await this.prisma.purchased_tickets.findMany({
            where: {
                status: purchased_tickets_status.unused,
                event_date_id: { not: null },
                event_dates: {
                    end_at: { lt: now },
                },
            },
            select: {
                id: true,
            },
        });

        // Then, find tickets without event_date_id where events.end_time < now
        const ticketsWithoutEventDate = await this.prisma.purchased_tickets.findMany({
            where: {
                status: purchased_tickets_status.unused,
                event_date_id: null,
                events: {
                    end_time: { lt: now },
                },
            },
            select: {
                id: true,
            },
        });

        // Combine all ticket IDs
        const ticketIds = [
            ...ticketsWithEventDate.map((t) => t.id),
            ...ticketsWithoutEventDate.map((t) => t.id),
        ];

        if (ticketIds.length === 0) {
            return {
                expired: 0,
                message: 'No tickets need to be expired',
            };
        }

        // Update all tickets to expired status
        const result = await this.prisma.purchased_tickets.updateMany({
            where: {
                id: { in: ticketIds },
            },
            data: {
                status: purchased_tickets_status.expired,
            },
        });

        return {
            expired: result.count,
            message: `Expired ${result.count} ticket(s)`,
        };
    }
}
