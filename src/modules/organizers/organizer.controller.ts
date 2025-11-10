import { Controller, Post, Body, Req, BadRequestException, Get, Param } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import { CreateOrganizerProfileDto } from '@common/dto/organizer.dto';
import type { Request } from 'express';
import { Public } from '@common/decorators/public.decorator';

@Controller('organizers')
export class OrganizerController {
    constructor(private readonly organizerService: OrganizerService) {}

    @Post()
    createOrganizer(@Body() createOrganizerDto: CreateOrganizerProfileDto, @Req() req: Request) {
        if (!req.user?.id) {
            throw new BadRequestException('User ID is required');
        }

        if (!createOrganizerDto) {
            throw new BadRequestException('Request body is required');
        }

        return this.organizerService.createOrganizerProfile(req.user.id, createOrganizerDto);
    }

    @Get('/profile')
    getOrganizerProfile() {
        return this.organizerService.getOrganizerProfile();
    }

    @Public()
    @Get('profile/:id')
    getOrganizerProfileByUserId(@Param('id') id: string) {
        if (!id) {
            throw new BadRequestException('User ID is required');
        }

        return this.organizerService.getOrganizerProfileByUserId(id);
    }
}
