import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { user_role } from 'generated/prisma';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isAdminOnly = this.reflector.getAllAndOverride<boolean>('adminOnly', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!isAdminOnly) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        if (user.role !== user_role.admin) {
            throw new ForbiddenException('Admin access required');
        }

        return true;
    }
}
