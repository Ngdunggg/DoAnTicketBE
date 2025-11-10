import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
    Body,
    UseGuards,
} from '@nestjs/common';
import { CloudinaryService } from '@common/services/cloudinary.service';
import { Public } from '@common/decorators/public.decorator';
import { JwtCookieGuard } from '@common/guards/jwt-cookie.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('uploads')
export class UploadsController {
    constructor(private readonly cloudinaryService: CloudinaryService) {}

    /**
     * Generate signed upload parameters for Cloudinary
     * POST /uploads/signature
     */
    @Post('signature')
    @UseGuards(JwtCookieGuard)
    generateUploadSignature() {
        return this.cloudinaryService.generateUploadSignature();
    }

    @Public()
    @Get('url')
    getUploadUrl(@Query('folder') folder?: string) {
        return this.cloudinaryService.generateUnsignedParams(folder);
    }

    @Public()
    @Post('file')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: { buffer?: Buffer; mimetype?: string },
        @Query('folder') folder?: string,
        @Query('publicId') publicId?: string
    ) {
        if (!file || !file.buffer || !file.mimetype) {
            throw new BadRequestException('File is required');
        }
        const result = await this.cloudinaryService.uploadBuffer(file.buffer, file.mimetype, folder, publicId);
        return { secure_url: result.secure_url, public_id: result.public_id, folder: folder || undefined };
    }
}
