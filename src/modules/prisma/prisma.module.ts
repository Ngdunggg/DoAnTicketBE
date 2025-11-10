import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prismas.service';

@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
