import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { CreateCategoryDto } from '@common/dto/category.dto';

@Injectable()
export class CategoryService {
    constructor(private prisma: PrismaService) {}

    async getAllCategories() {
        return this.prisma.categories.findMany({
            select: {
                id: true,
                name: true,
            },
        });
    }

    async getCategoryById(id: string) {
        return this.prisma.categories.findUnique({
            where: { id },
        });
    }

    async createCategory(createCategoryDto: CreateCategoryDto) {
        return this.prisma.categories.create({
            data: createCategoryDto,
        });
    }

    async assignCategoriesToEvent(eventId: string, categoryIds: string[]) {
        if (categoryIds && categoryIds.length > 0) {
            await this.prisma.event_categories.createMany({
                data: categoryIds.map((categoryId) => ({
                    event_id: eventId,
                    category_id: categoryId,
                })),
            });
        }
    }

    /**
     * Update a category
     * @param id - The category ID
     * @param updateData - The data to update
     * @returns The updated category
     */
    async updateCategory(id: string, updateData: Partial<CreateCategoryDto>) {
        // Check if category exists
        const existingCategory = await this.getCategoryById(id);
        if (!existingCategory) {
            throw new NotFoundException('Category not found');
        }

        return await this.prisma.categories.update({
            where: { id },
            data: updateData,
        });
    }

    /**
     * Delete a category
     * @param id - The category ID
     * @returns Success message
     */
    async deleteCategory(id: string) {
        // Check if category exists
        const existingCategory = await this.getCategoryById(id);
        if (!existingCategory) {
            throw new NotFoundException('Category not found');
        }

        // Check if category is being used by any events
        const eventsUsingCategory = await this.prisma.event_categories.count({
            where: { category_id: id },
        });

        if (eventsUsingCategory > 0) {
            throw new BadRequestException('Cannot delete category that is being used by events');
        }

        await this.prisma.categories.delete({
            where: { id },
        });

        return { message: 'Category deleted successfully' };
    }
}
