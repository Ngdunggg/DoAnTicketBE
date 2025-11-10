import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { OrganizerService } from './organizer.service';
import { OrganizerController } from './organizer.controller';
import { CloudinaryService } from '@common/services/cloudinary.service';

@Module({
    imports: [PrismaModule],
    providers: [OrganizerService, CloudinaryService],
    controllers: [OrganizerController],
    exports: [OrganizerService],
})
export class OrganizerModule {}
