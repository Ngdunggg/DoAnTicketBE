import { IsString, IsNotEmpty, IsEnum, IsUrl } from 'class-validator';
import { image_type } from 'generated/prisma';

export class CreateImageDto {
    @IsString()
    @IsNotEmpty()
    @IsUrl({}, { message: 'image_url must be a valid URL' })
    image_url: string;

    @IsEnum(image_type, { message: 'image_type must be either "banner" or "card"' })
    @IsNotEmpty()
    image_type: image_type;
}

