import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderService } from '@modules/orders/order.service';

/**
 * CleanupService - Service để dọn dẹp các reservation hết hạn
 * 
 * Chức năng:
 * 1. Chạy cron job mỗi phút để cleanup expired reservations
 * 2. Log kết quả cleanup để monitoring
 * 3. Handle errors gracefully để không ảnh hưởng đến hệ thống chính
 */
@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(private readonly orderService: OrderService) {}

    /**
     * Cron job chạy mỗi phút để cleanup expired reservations
     * 
     * Tại sao chạy mỗi phút?
     * - Reservation timeout là 15 phút
     * - Chạy mỗi phút đảm bảo cleanup kịp thời
     * - Không quá tải database với frequent queries
     */
    @Cron('* * * * *') // Every minute
    async handleExpiredReservations() {
        try {
            this.logger.log('Starting cleanup of expired reservations...');
            
            const result = await this.orderService.cleanupExpiredReservations();
            
            if (result.cleaned > 0) {
                this.logger.log(
                    `Cleanup completed: ${result.cleaned} ticket types cleaned, ${result.expiredOrders} orders expired`
                );
            } else {
                this.logger.debug('No expired reservations found');
            }
        } catch (error) {
            // Log error nhưng không throw để không crash cron job
            this.logger.error('Error during cleanup of expired reservations:', error);
        }
    }

    /**
     * Manual cleanup method - có thể gọi từ API hoặc admin panel
     */
    async manualCleanup() {
        try {
            this.logger.log('Manual cleanup triggered...');
            
            const result = await this.orderService.cleanupExpiredReservations();
            
            this.logger.log(
                `Manual cleanup completed: ${result.cleaned} ticket types cleaned, ${result.expiredOrders} orders expired`
            );
            
            return result;
        } catch (error) {
            this.logger.error('Error during manual cleanup:', error);
            throw error;
        }
    }

    /**
     * Get statistics về reservations hiện tại
     * Useful cho monitoring và debugging
     */
    getReservationStats() {
        // Method này có thể được implement để return stats
        // về số lượng reservations đang active, expired, etc.
        return {
            message: 'Reservation stats endpoint - to be implemented',
            timestamp: new Date().toISOString(),
        };
    }
}
