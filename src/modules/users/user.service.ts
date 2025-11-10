import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { user_role, users } from 'generated/prisma';
import { CreateUserDto } from '@common/dto/auth.dto';
import { UpdateUserProfileDto } from '@common/dto/user.dto';
import { excludePassword, excludePasswordFromUsers } from '@common/utils/user.util';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) {}

    async createUser(createUserDto: CreateUserDto): Promise<Omit<users, 'password'>> {
        const user = await this.prisma.users.create({
            data: createUserDto,
        });
        return excludePassword(user);
    }

    /**
     * Find a user by email (without password)
     * @param email - The email of the user
     * @returns The user if found, otherwise null
     */
    async findByEmail(email: string): Promise<Omit<users, 'password'> | null> {
        const user = await this.prisma.users.findUnique({
            where: { email },
        });
        return user ? excludePassword(user) : null;
    }

    /**
     * Find a user by email with password (for authentication only)
     * @param email - The email of the user
     * @returns The user if found, otherwise null
     */
    async findByEmailWithPassword(email: string): Promise<users | null> {
        return await this.prisma.users.findUnique({
            where: { email },
        });
    }

    async findUserById(id: string): Promise<Omit<users, 'password'> | null> {
        const user = await this.prisma.users.findUnique({
            where: { id },
        });
        return user ? excludePassword(user) : null;
    }

    async updateUserRole(id: string, role: user_role): Promise<Omit<users, 'password'>> {
        const user = await this.prisma.users.update({
            where: { id },
            data: { role },
        });
        return excludePassword(user);
    }

    async getUsers(): Promise<Omit<users, 'password'>[]> {
        const usersList = await this.prisma.users.findMany();
        return excludePasswordFromUsers(usersList);
    }

    /**
     * Update user profile information
     * @param id - The user ID
     * @param updateData - The data to update
     * @returns The updated user
     */
    async updateUserProfile(updateData: UpdateUserProfileDto): Promise<Omit<users, 'password'>> {
        const user = await this.prisma.users.update({
            where: { id: updateData.id },
            data: { ...updateData },
        });
        return excludePassword(user);
    }

    async updatePassword(id: string, password: string): Promise<Omit<users, 'password'>> {
        const user = await this.prisma.users.update({
            where: { id },
            data: { password },
        });
        return excludePassword(user);
    }

    async getUserInfo(id: string): Promise<Omit<users, 'password'> | null> {
        const user = await this.prisma.users.findUnique({
            where: { id },
        });
        return user ? excludePassword(user) : null;
    }
}
