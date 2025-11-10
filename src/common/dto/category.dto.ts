import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class AssignCategoriesDto {
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    category_ids: string[];
}
