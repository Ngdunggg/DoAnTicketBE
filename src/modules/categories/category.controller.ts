import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Public } from '@common/decorators/public.decorator';
import { AdminOnly } from '@common/decorators/admin.decorator';
import { AdminGuard } from '@common/guards/admin.guard';
import { CreateCategoryDto } from '@common/dto/category.dto';

@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Public()
    @Get()
    getCategories() {
        return this.categoryService.getAllCategories();
    }

    @Public()
    @Get(':id')
    getCategoryById(@Param('id') id: string) {
        return this.categoryService.getCategoryById(id);
    }

    @AdminOnly()
    @UseGuards(AdminGuard)
    @Post()
    createCategory(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoryService.createCategory(createCategoryDto);
    }

    @AdminOnly()
    @UseGuards(AdminGuard)
    @Put(':id')
    updateCategory(
        @Param('id') id: string,
        @Body() updateData: Partial<CreateCategoryDto>
    ) {
        return this.categoryService.updateCategory(id, updateData);
    }

    @AdminOnly()
    @UseGuards(AdminGuard)
    @Delete(':id')
    deleteCategory(@Param('id') id: string) {
        return this.categoryService.deleteCategory(id);
    }
}
