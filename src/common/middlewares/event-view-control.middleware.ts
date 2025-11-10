import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

// Simple in-memory store (trong production nên dùng Redis)
const viewStore = new Map<string, number>();

@Injectable()
export class EventViewControlMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const eventId = req.params.id;
        const ip =
            (req.headers['x-forwarded-for'] as string) ||
            (req.headers['x-real-ip'] as string) ||
            req.connection.remoteAddress ||
            'unknown';

        const key = `event-view:${eventId}:${ip}`;
        const now = Date.now();
        const lastView = viewStore.get(key);

        // Luôn cho phép request, chỉ đánh dấu có nên tăng view hay không
        if (!lastView || now - lastView > 30 * 60 * 1000) {
            // Chưa view hoặc đã quá 30 phút - cho phép tăng view
            viewStore.set(key, now);
            (req as Request & { shouldIncrementView?: boolean }).shouldIncrementView = true;
        } else {
            // Đã view trong 30 phút - không tăng view
            (req as Request & { shouldIncrementView?: boolean }).shouldIncrementView = false;
        }

        next(); // Luôn cho phép request
    }
}
