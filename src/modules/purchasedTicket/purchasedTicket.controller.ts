import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { PurchasedTicketService } from './purchasedTicket.service';
import type { Request } from 'express';
import { Public } from '@common/decorators/public.decorator';
import { purchased_tickets_status } from 'generated/prisma';

@Controller('purchased-tickets')
export class PurchasedTicketController {
    constructor(private readonly purchasedTicketService: PurchasedTicketService) {}

    @Get('my-tickets')
    async getMyTickets(@Req() req: Request) {
        const userId = req.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return this.purchasedTicketService.getTicketsByUserId(userId);
    }

    @Get('event/:eventId')
    async getTicketsByEventId(@Param('eventId') eventId: string) {
        return this.purchasedTicketService.getTicketsByEventId(eventId);
    }

    @Public()
    @Get(':ticketId')
    async getTicketById(@Param('ticketId') ticketId: string) {
        return this.purchasedTicketService.getTicketById(ticketId);
    }

    @Public()
    @Patch(':ticketId')
    async checkInTicket(@Param('ticketId') ticketId: string, @Body() body: { status: purchased_tickets_status }) {
        return this.purchasedTicketService.checkInTicket(ticketId, body.status);
    }

    @Public()
    @Get('debug/expire-check')
    async getTicketsToExpire() {
        return this.purchasedTicketService.getTicketsToExpire();
    }

    @Public()
    @Get('debug/expire-now')
    async expireTicketsNow() {
        return this.purchasedTicketService.expireTicketsForEndedEvents();
    }
}
