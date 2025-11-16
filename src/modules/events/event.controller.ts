import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Req,
    BadRequestException,
    Delete,
    Patch,
    ParseUUIDPipe,
} from '@nestjs/common';
import { EventService } from './event.service';
import { Public } from '@common/decorators/public.decorator';
import { FormattedEvent } from '@shared/interface/event';
import { CreateEventDto } from '@common/dto/event.dto';
import type { Request } from 'express';
import { event_status } from 'generated/prisma/client';

interface RequestWithViewControl extends Request {
    shouldIncrementView?: boolean;
}

@Controller('events')
export class EventController {
    constructor(private eventService: EventService) {}

    @Post('/create-event')
    async createEvent(@Body() createEventDto: CreateEventDto, @Req() req: Request) {
        // Lấy userId từ cookies
        const userId = req.user?.id;

        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        // Kiểm tra body có tồn tại không
        if (!createEventDto) {
            throw new BadRequestException('Request body is required');
        }

        return this.eventService.createEvent(createEventDto, userId);
    }

    @Patch('/update-event/:id')
    async updateEvent(
        @Param('id', new ParseUUIDPipe()) eventId: string,
        @Body() updateEventDto: CreateEventDto,
        @Req() req: Request
    ) {
        // Lấy userId từ cookies
        const userId = req.user?.id;
        
        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        // Kiểm tra body có tồn tại không
        if (!updateEventDto) {
            throw new BadRequestException('Request body is required');
        }

        return this.eventService.updateEvent(eventId, updateEventDto, userId);
    }

    @Public()
    @Get('/list-events')
    async getAllEvents(): Promise<FormattedEvent[]> {
        return this.eventService.getAllEvents();
    }

    @Get('event-by-admin')
    async getEventsByAdmin() {
        return this.eventService.getEventsByAdmin();
    }

    @Public()
    @Get('/:id')
    async getEventById(@Param('id', new ParseUUIDPipe()) eventId: string, @Req() req: RequestWithViewControl) {
        // Lấy flag từ middleware, mặc định là true
        const shouldIncrementView = req.shouldIncrementView ?? true;
        return this.eventService.getEventById(eventId, shouldIncrementView);
    }

    @Get('/report/:id')
    async getEventReport(@Param('id', new ParseUUIDPipe()) eventId: string) {
        return this.eventService.getEventReport(eventId);
    }

    @Delete('/:id')
    async deleteEvent(@Param('id', new ParseUUIDPipe()) eventId: string, @Req() req: Request) {
        // Lấy userId từ cookies
        const userId = req.user?.id;

        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        return this.eventService.deleteEvent(eventId, userId);
    }

    @Get('organizer/:userId')
    async getEventsByUserId(@Param('userId', new ParseUUIDPipe()) userId: string) {
        return this.eventService.getEventsByOrganizerId(userId);
    }

    @Patch('update-event-status/:id')
    async updateEventStatus(@Param('id', new ParseUUIDPipe()) eventId: string, @Body() body: { status: event_status }) {
        return this.eventService.updateEventStatus(eventId, body.status);
    }
}
