import { Transform } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEventDateDto {
    @IsDate()
    @IsNotEmpty()
    @Transform(({ value }: { value: string }) => new Date(value))
    start_at: Date;

    @IsDate()
    @IsOptional()
    @Transform(({ value }: { value: string }) => new Date(value))
    end_at: Date;
}
