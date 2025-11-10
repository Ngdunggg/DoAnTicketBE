import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { AdminGuard } from '@common/guards/admin.guard';

@Module({
    imports: [PrismaModule],
    controllers: [CategoryController],
    providers: [CategoryService, AdminGuard],
    exports: [CategoryService],
})
export class CategoryModule {}
