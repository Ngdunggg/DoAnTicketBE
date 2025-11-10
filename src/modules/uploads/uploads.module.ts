import { Module } from '@nestjs/common';
import { CloudinaryService } from '@common/services/cloudinary.service';
import { UploadsController } from './uploads.controller';

@Module({
    controllers: [UploadsController],
    providers: [CloudinaryService],
    exports: [CloudinaryService],
})
export class UploadsModule {}


