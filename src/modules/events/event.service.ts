import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prismas.service';
import { RawEvent, FormattedEvent, EventReport, OrderItemWithRelations } from '@shared/interface/event';
import { CreateEventDto } from '@common/dto/event.dto';
import { event_status, user_role, orders_status, image_type } from 'generated/prisma';
import { CategoryService } from '@modules/categories/category.service';
import { OrganizerService } from '@modules/organizers/organizer.service';
import { TicketService } from '@modules/tickets/ticket.service';
import { UserService } from '@modules/users/user.service';
import { FormatUtil } from '@common/utils/format.util';
import { CloudinaryService } from '@common/services/cloudinary.service';
import { OrderService } from '../orders/order.service';

@Injectable()
export class EventService {
    constructor(
        private prisma: PrismaService,
        private categoryService: CategoryService,
        private organizerService: OrganizerService,
        private ticketService: TicketService,
        private userService: UserService,
        private cloudinaryService: CloudinaryService,
        private orderService: OrderService
    ) {}

    private formatEvent(event: RawEvent): FormattedEvent {
        return {
            // Thông tin cơ bản
            id: event.id,
            organizer_id: event.organizer_id,
            title: event.title,
            description: event.description,
            location: event.location,
            start_time: event.start_time,
            end_time: event.end_time,
            created_at: event.created_at,
            status: event.status,
            is_online: event.is_online,
            event_views: event.event_views.map((view) => ({
                id: view.id,
                event_id: view.event_id,
                viewed_at: view.viewed_at,
            })),
            // Dữ liệu đã format - dễ sử dụng
            categories:
                event.event_categories?.map((ec) => ({
                    id: ec.categories.id,
                    name: ec.categories.name,
                })) || [],
            images:
                event.event_images?.map((img) => ({
                    image_url: img.image_url,
                    image_type: img.image_type,
                })) || [],
            dates:
                event.event_dates?.map((date) => ({
                    id: date.id,
                    start_at: date.start_at,
                    end_at: date.end_at,
                })) || [],
            total_views: event.event_views?.length || 0,
            ticket_types:
                event.ticket_types?.map((ticket) => ({
                    id: ticket.id,
                    name: ticket.name,
                    price: this.convertDecimalToNumber(ticket.price),
                    initial_quantity: ticket.initial_quantity,
                    remaining_quantity: ticket.remaining_quantity,
                    status: ticket.status,
                })) || [],
        };
    }

    private formatEventReport(eventReportData: EventReport): EventReport {
        return {
            event: eventReportData.event, // Event đã được format rồi, không cần format lại

            summary: {
                ...eventReportData.summary,
                total_revenue: FormatUtil.roundNumber(eventReportData.summary.total_revenue),
            },

            daily_stats: {
                views: FormatUtil.sortByDate(eventReportData.daily_stats.views),
                revenue: FormatUtil.sortByDate(eventReportData.daily_stats.revenue),
            },

            purchased_tickets: eventReportData.purchased_tickets,
            order_items: eventReportData.order_items,

            ticket_types: eventReportData.ticket_types.map((ticket) => ({
                ...ticket,
                price: FormatUtil.roundNumber(ticket.price),
                sold_percentage: FormatUtil.calculatePercentage(ticket.sold_quantity, ticket.initial_quantity),
                remaining_percentage: FormatUtil.calculatePercentage(
                    ticket.remaining_quantity,
                    ticket.initial_quantity
                ),
            })),
        };
    }
    // Helper function để convert Decimal to number
    private convertDecimalToNumber(decimal: any): number {
        if (typeof decimal === 'number') return decimal;
        if (typeof decimal === 'string') return parseFloat(decimal);
        if (decimal && typeof (decimal as { toNumber: () => number }).toNumber === 'function') {
            try {
                return (decimal as { toNumber: () => number }).toNumber();
            } catch {
                return 0;
            }
        }
        return 0;
    }

    // Method đơn giản để tăng view count
    private async incrementEventView(eventId: string) {
        try {
            // Kiểm tra event có tồn tại không trước khi tăng view
            const eventExists = await this.prisma.events.findUnique({
                where: { id: eventId },
                select: { id: true },
            });

            if (!eventExists) {
                console.warn(`Event with id ${eventId} does not exist, skipping view increment`);
                return;
            }

            await this.prisma.event_views.create({
                data: {
                    event_id: eventId,
                    viewed_at: new Date(),
                },
            });
        } catch (error) {
            // Log error nhưng không throw để không ảnh hưởng đến việc lấy event
            console.error('Error incrementing event view:', error);
        }
    }

    async createEvent(eventData: CreateEventDto, userId: string) {
        // Sử dụng transaction để đảm bảo data consistency
        return await this.prisma.$transaction(async (prisma) => {
            // 1. Tạo event cơ bản
            const event = await prisma.events.create({
                data: {
                    title: eventData.title,
                    description: eventData.description,
                    location: eventData.location || null,
                    organizer_id: userId,
                    start_time: eventData.start_time,
                    end_time: eventData.end_time,
                    status: event_status.pending,
                    is_online: eventData.is_online,
                },
            });

            // 2. Validate và tạo categories (sử dụng CategoryService)
            if (eventData.category_id && eventData.category_id.length > 0) {
                // Validate categories exist
                const existingCategories = await prisma.categories.findMany({
                    where: { id: { in: eventData.category_id } },
                    select: { id: true },
                });

                if (existingCategories.length !== eventData.category_id.length) {
                    const foundIds = existingCategories.map((cat) => cat.id);
                    const missingIds = eventData.category_id.filter((id) => !foundIds.includes(id));

                    throw new BadRequestException(`Categories not found: ${missingIds.join(', ')}`);
                }

                // Assign categories using transaction prisma
                await prisma.event_categories.createMany({
                    data: eventData.category_id.map((categoryId) => ({
                        event_id: event.id,
                        category_id: categoryId,
                    })),
                });
            }

            // 3. Upload images to Cloudinary và tạo images
            if (eventData.images && eventData.images.length > 0) {
                // Validate image types
                const validImageTypes = [image_type.banner, image_type.card];
                const invalidImages = eventData.images.filter((image) => !validImageTypes.includes(image.image_type));

                if (invalidImages.length > 0) {
                    throw new BadRequestException(
                        `Invalid image types: ${invalidImages.map((img) => img.image_type).join(', ')}. Only 'banner' and 'card' are allowed.`
                    );
                }

                // Validate có ít nhất một ảnh banner
                const bannerImages = eventData.images.filter((img) => img.image_type === image_type.banner);
                if (bannerImages.length === 0) {
                    throw new BadRequestException('At least one banner image is required');
                }

                // Save uploaded images to database
                await prisma.event_images.createMany({
                    data: eventData.images.map((img) => ({
                        event_id: event.id,
                        image_url: img.image_url,
                        image_type: img.image_type,
                    })),
                });
            }

            // 4. Tạo event dates
            if (eventData.event_dates && eventData.event_dates.length > 0) {
                await prisma.event_dates.createMany({
                    data: eventData.event_dates.map((date) => ({
                        event_id: event.id,
                        start_at: date.start_at,
                        end_at: date.end_at,
                    })),
                });
            }

            // 5. Tạo tickets (sử dụng TicketService)
            if (eventData.tickets && eventData.tickets.length > 0) {
                await prisma.ticket_types.createMany({
                    data: eventData.tickets.map((ticket) => ({
                        event_id: event.id,
                        name: ticket.name,
                        price: ticket.price,
                        initial_quantity: ticket.initial_quantity,
                        remaining_quantity: ticket.initial_quantity, // Ban đầu = initial_quantity
                        status: ticket.status,
                        description: ticket.description,
                    })),
                });
            }

            // 6. Tạo hoặc update organizer profile (sử dụng OrganizerService)
            await this.organizerService.createOrUpdateOrganizerProfile(userId, eventData.organizer_profile);

            // 7. Tạo hoặc update payment method (sử dụng OrganizerService)
            await this.organizerService.createOrUpdatePaymentMethod(userId, eventData.payment_method);

            // 8. Update user role nếu cần
            const user = await this.userService.findUserById(userId);
            if (user && user.role === user_role.user) {
                await this.userService.updateUserRole(userId, user_role.organizer);
            }

            return { message: 'Event created successfully', eventId: event.id };
        });
    }

    async getEventById(id: string, shouldIncrementView: boolean = true) {
        if (!id) {
            throw new BadRequestException('Event id is required');
        }

        // Chỉ tăng view count nếu middleware cho phép
        if (shouldIncrementView) {
            await this.incrementEventView(id);
        }

        const event = await this.prisma.events.findUnique({
            where: { id },
            include: {
                event_categories: {
                    include: {
                        categories: true,
                    },
                },
                event_images: true,
                event_dates: true,
                event_views: true,
                ticket_types: true,
            },
        });

        if (!event) {
            throw new NotFoundException('Event not found');
        }

        return this.formatEvent(event as RawEvent);
    }

    async getAllEvents() {
        const events = await this.prisma.events.findMany({
            include: {
                event_categories: {
                    include: {
                        categories: true,
                    },
                },
                event_images: true,
                event_dates: true,
                event_views: true,
                ticket_types: true,
            },
        });

        if (!events) {
            throw new NotFoundException('Events not found');
        }

        return events.map((event) => this.formatEvent(event as RawEvent));
    }

    async getEventsByOrganizerId(organizerId: string) {
        const events = await this.prisma.events.findMany({
            where: { organizer_id: organizerId },
            include: {
                event_categories: {
                    include: {
                        categories: true,
                    },
                },
                event_images: true,
                event_dates: true,
                event_views: true,
                ticket_types: true,
            },
        });

        if (!events) {
            throw new NotFoundException('Events by organizer not found');
        }

        return events.map((event) => this.formatEvent(event as RawEvent));
    }

    async getEventsByIds(ids: string[]) {
        const events = await this.prisma.events.findMany({
            where: { id: { in: ids } },
            include: {
                event_categories: {
                    include: {
                        categories: true,
                    },
                },
                event_images: true,
                event_dates: true,
                event_views: true,
                ticket_types: true,
            },
        });

        if (!events) {
            throw new NotFoundException('Events not found');
        }

        return events.map((event) => this.formatEvent(event as RawEvent));
    }

    async getEventReport(eventId: string) {
        // 1. Thông tin cơ bản của sự kiện
        const event = await this.prisma.events.findUnique({
            where: { id: eventId },
            include: {
                event_categories: {
                    include: {
                        categories: true,
                    },
                },
                event_images: true,
                event_dates: true,
                event_views: true,
                ticket_types: true,
            },
        });

        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // 2. Tổng lượt truy cập
        const totalViews = await this.prisma.event_views.count({
            where: { event_id: eventId },
        });

        // 3. Lượt truy cập theo ngày
        const viewsByDate = await this.prisma.event_views.groupBy({
            by: ['viewed_at'],
            where: { event_id: eventId },
            _count: {
                viewed_at: true,
            },
            orderBy: {
                viewed_at: 'asc',
            },
        });

        // 4. Tổng doanh thu và thống kê vé
        const ticketStats = await this.prisma.ticket_types.aggregate({
            where: { event_id: eventId },
            _sum: {
                initial_quantity: true,
                remaining_quantity: true,
            },
        });

        // 5. Lấy tất cả purchased_tickets của event với thông tin order đầy đủ
        const purchasedTickets = await this.prisma.purchased_tickets.findMany({
            where: {
                ticket_types: {
                    event_id: eventId,
                },
            },
            include: {
                ticket_types: {
                    select: {
                        name: true,
                        price: true,
                    },
                },
                orders: {
                    select: {
                        id: true,
                        total_amount: true,
                        created_at: true,
                        status: true,
                        buyer_email: true,
                        buyer_phone: true,
                    },
                },
            },
        });

        // 6. Lấy thông tin order_items để tính số lượng thực tế đã mua
        const orderItems: OrderItemWithRelations[] = await this.prisma.order_items.findMany({
            where: {
                ticket_types: {
                    event_id: eventId,
                },
            },
            include: {
                ticket_types: {
                    select: {
                        name: true,
                        price: true,
                    },
                },
                orders: {
                    select: {
                        id: true,
                        total_amount: true,
                        created_at: true,
                        status: true,
                        buyer_email: true,
                        buyer_phone: true,
                    },
                },
            },
        });

        // 7. Tính tổng doanh thu từ các order đã thanh toán thành công
        const totalRevenue = orderItems
            .filter((item) => item.orders.status === orders_status.paid)
            .reduce((sum, item) => {
                // Tính doanh thu từ số lượng * giá vé
                return sum + item.quantity * this.convertDecimalToNumber(item.ticket_types.price);
            }, 0);

        // 8. Thống kê doanh thu theo ngày
        const revenueByDate = orderItems
            .filter((item) => item.orders.status === orders_status.paid)
            .reduce(
                (acc, item) => {
                    const date = item.orders.created_at.toISOString().split('T')[0];
                    const revenue = item.quantity * this.convertDecimalToNumber(item.ticket_types.price);

                    if (!acc[date]) {
                        acc[date] = { date, revenue: 0, orders: 0 };
                    }
                    acc[date].revenue += revenue;
                    acc[date].orders += 1;

                    return acc;
                },
                {} as Record<string, { date: string; revenue: number; orders: number }>
            );

        // 9. Thống kê vé theo loại với số lượng thực tế đã bán
        const ticketTypeStats = await this.prisma.ticket_types.findMany({
            where: { event_id: eventId },
            select: {
                id: true,
                name: true,
                price: true,
                initial_quantity: true,
                remaining_quantity: true,
                status: true,
                _count: {
                    select: {
                        purchased_tickets: true,
                    },
                },
            },
        });

        return this.formatEventReport({
            // Thông tin cơ bản - format event trước khi truyền vào
            event: this.formatEvent(event as RawEvent),

            // Thống kê tổng quan
            summary: {
                total_views: totalViews,
                total_tickets_available: ticketStats._sum.initial_quantity || 0,
                total_tickets_remaining: ticketStats._sum.remaining_quantity || 0,
                total_revenue: totalRevenue,
                total_orders: orderItems.filter((item) => item.orders.status === orders_status.paid).length,
            },

            // Thống kê theo ngày
            daily_stats: {
                views: viewsByDate.map((view) => ({
                    date: view.viewed_at,
                    count: view._count.viewed_at,
                })),
                revenue: Object.values(revenueByDate).map((item) => ({
                    date: new Date(item.date),
                    revenue: item.revenue,
                    orders: item.orders,
                })),
            },

            // Raw data cho frontend xử lý
            purchased_tickets: purchasedTickets || [],
            order_items: orderItems || [],

            // Thống kê vé theo loại
            ticket_types: ticketTypeStats.map((ticket) => ({
                id: ticket.id,
                name: ticket.name,
                price: this.convertDecimalToNumber(ticket.price),
                initial_quantity: ticket.initial_quantity,
                remaining_quantity: ticket.remaining_quantity,
                sold_quantity: ticket.initial_quantity - ticket.remaining_quantity,
                status: ticket.status,
                sold_count: ticket._count.purchased_tickets,
                sold_percentage: 0, // Sẽ được tính trong hàm formatEventReport
                remaining_percentage: 0, // Sẽ được tính trong hàm formatEventReport
            })),
        });
    }

    /**
     * Delete an event (only if status is pending)
     * @param eventId - The event ID to delete
     * @param userId - The user ID requesting deletion
     * @returns Success message
     */
    async deleteEvent(eventId: string, userId: string) {
        // 1. Check if event exists
        const event = await this.prisma.events.findUnique({
            where: { id: eventId },
        });

        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // 2. Check if user is the owner of the event
        if (event.organizer_id !== userId) {
            throw new ForbiddenException('You can only delete your own events');
        }

        // 3. Check if event status is pending
        if (
            event.status !== event_status.pending &&
            event.status !== event_status.rejected
        ) {
            throw new ForbiddenException('Only pending or rejected events can be deleted');
        }

        // 4. Check if there are purchased tickets (cannot delete if tickets are already sold)
        const purchasedTicketsCount = await this.prisma.purchased_tickets.count({
            where: { event_id: eventId },
        });

        if (purchasedTicketsCount > 0) {
            throw new BadRequestException('Cannot delete event that has purchased tickets');
        }

        // 5. Check if there are orders with this event's ticket types
        const ticketTypes = await this.prisma.ticket_types.findMany({
            where: { event_id: eventId },
            select: { id: true },
        });

        if (ticketTypes.length > 0) {
            const ticketTypeIds = ticketTypes.map((tt) => tt.id);
            const ordersCount = await this.prisma.order_items.count({
                where: { ticket_type_id: { in: ticketTypeIds } },
            });

            if (ordersCount > 0) {
                throw new BadRequestException('Cannot delete event that has orders');
            }
        }

        // 6. Delete related records in correct order (using transaction)
        await this.prisma.$transaction(async (tx) => {
            // Delete event_categories
            await tx.event_categories.deleteMany({
                where: { event_id: eventId },
            });

            // Delete event_images
            await tx.event_images.deleteMany({
                where: { event_id: eventId },
            });

            // Delete event_views
            await tx.event_views.deleteMany({
                where: { event_id: eventId },
            });

            // Delete ticket_types (only if no purchased tickets or orders)
            await tx.ticket_types.deleteMany({
                where: { event_id: eventId },
            });

            // Delete event_dates (after ticket_types because ticket_types may reference event_dates)
            await tx.event_dates.deleteMany({
                where: { event_id: eventId },
            });

            // Finally delete the event
            await tx.events.delete({
                where: { id: eventId },
            });
        });

        return { message: 'Event deleted successfully' };
    }

    // async updateEvent(id: string, eventData: CreateEventDto) {
    //     const event = await this.prisma.events.update({
    //         where: { id },
    //         data: eventData,
    //     });
    //     return event;
    // }

    async updateEventStatus(eventId: string, status: event_status) {
        const event = await this.prisma.events.update({
            where: { id: eventId },
            data: { status: status },
        });

        return event;
    }

    async getEventsByAdmin() {
        const events = await this.getAllEvents();
        const orders = await this.orderService.getAllOrders();
        const users = await this.userService.getUsers();

        return {
            events,
            orders,
            users,
        };
    }
}
