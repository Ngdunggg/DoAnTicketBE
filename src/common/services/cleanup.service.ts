import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderService } from '@modules/orders/order.service';
import { PurchasedTicketService } from '@modules/purchasedTicket/purchasedTicket.service';

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

    constructor(
        private readonly orderService: OrderService,
        private readonly purchasedTicketService: PurchasedTicketService,
    ) {}

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
            
            if (result.expiredOrders > 0) {
                this.logger.log(
                    `Cleanup completed: ${result.expiredOrders} orders expired and tickets released`
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
                `Manual cleanup completed: ${result.expiredOrders} orders expired and tickets released`
            );
            
            return result;
        } catch (error) {
            this.logger.error('Error during manual cleanup:', error);
            throw error;
        }
    }

    /**
     * Cron job chạy mỗi ngày 1 lần (lúc 1 giờ sáng) để expire tickets cho các sự kiện đã kết thúc
     * 
     * Tại sao chạy 1 ngày 1 lần?
     * - Events thường kéo dài nhiều giờ hoặc nhiều ngày, không cần expire ngay lập tức
     * - Giảm tải database với ít queries hơn
     * - Chạy vào 1 giờ sáng để tránh giờ cao điểm
     */
    @Cron('0 1 * * *') // Every day at 1:00 AM
    async handleExpiredTickets() {
        try {
            this.logger.log('Starting expiration of tickets for ended events...');
            
            // Debug: Check how many tickets need to be expired
            const ticketsToExpire = await this.purchasedTicketService.getTicketsToExpire();
            this.logger.debug(
                `Found ${ticketsToExpire.total} ticket(s) to expire (${ticketsToExpire.withEventDate.length} with event_date, ${ticketsToExpire.withoutEventDate.length} without event_date)`
            );
            
            const result = await this.purchasedTicketService.expireTicketsForEndedEvents();
            
            if (result.expired > 0) {
                this.logger.log(
                    `Ticket expiration completed: ${result.expired} ticket(s) expired`
                );
            } else {
                this.logger.debug('No tickets need to be expired');
            }
        } catch (error) {
            // Log error nhưng không throw để không crash cron job
            this.logger.error('Error during ticket expiration:', error);
            if (error instanceof Error) {
                this.logger.error('Error stack:', error.stack);
            }
        }
    }

    /**
     * Manual expiration method - có thể gọi từ API hoặc admin panel
     */
    async manualExpireTickets() {
        try {
            this.logger.log('Manual ticket expiration triggered...');
            
            const result = await this.purchasedTicketService.expireTicketsForEndedEvents();
            
            this.logger.log(
                `Manual ticket expiration completed: ${result.expired} ticket(s) expired`
            );
            
            return result;
        } catch (error) {
            this.logger.error('Error during manual ticket expiration:', error);
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
