import { BadRequestException, Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from '@common/dto/auth.dto';
import { UpdateUserProfileDto } from '@common/dto/user.dto';
import { Public } from '@common/decorators/public.decorator';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Public()
    @Get()
    getUsers() {
        return this.userService.getUsers();
    }

    @Post('create')
    createUser(@Body() createUserDto: CreateUserDto) {
        return this.userService.createUser(createUserDto);
    }

    @Patch('profile')
    async updateUserProfile(@Body() updateUserProfileDto: UpdateUserProfileDto) {
        return this.userService.updateUserProfile(updateUserProfileDto);
    }

    @Get('user-info')
    getUserInfo(@Query('id') id: string) {
        if (!id) {
            throw new BadRequestException('User ID is required');
        }
        return this.userService.getUserInfo(id);
    }
}
