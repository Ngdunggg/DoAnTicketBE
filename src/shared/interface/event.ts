import {
    event_images,
    categories,
    event_categories,
    events,
    event_dates,
    event_views,
    ticket_types,
    image_type,
    ticket_type_status,
    purchased_tickets,
    order_items,
    orders_status,
} from 'generated/prisma';

// Interface cho dữ liệu thô từ Prisma
export interface RawEvent extends events {
    event_categories: (event_categories & { categories: categories })[];
    event_images: event_images[];
    event_dates: event_dates[];
    event_views: event_views[];
    ticket_types: ticket_types[];
}

// Interface cho order_items với relations
export interface OrderItemWithRelations extends order_items {
    ticket_types: {
        name: string;
        price: any;
    };
    orders: {
        id: string;
        total_amount: any;
        created_at: Date;
        status: orders_status;
        buyer_email: string;
        buyer_phone: string;
    };
}

// Interface cho dữ liệu đã format - dễ sử dụng
export interface FormattedEvent {
    // Thông tin cơ bản của event
    id: string;
    organizer_id: string;
    title: string;
    description: string;
    location: string | null;
    start_time: Date;
    end_time: Date;
    created_at: Date;
    status: string;
    is_online: boolean;
    event_views: event_views[];
    categories: { id: string; name: string }[];
    images: { image_url: string; image_type: image_type }[];
    dates: { id: string; start_at: Date; end_at: Date }[];
    total_views: number;
    ticket_types: {
        id: string;
        name: string;
        price: number;
        initial_quantity: number;
        remaining_quantity: number;
        status: ticket_type_status;
    }[];
}

export interface EventReport {
    // Thông tin cơ bản
    event: FormattedEvent,

    // Thống kê tổng quan
    summary: {
        total_views: number,
        total_tickets_available: number,
        total_tickets_remaining: number,
        total_revenue: number,
        total_orders: number,
    },

    // Thống kê theo ngày
    daily_stats: {
        views: {
            date: Date,
            count: number,
        }[],
        revenue: {
            date: Date,
            revenue: number,
            orders: number,
        }[],
    },

    // Raw data cho frontend xử lý
    purchased_tickets: purchased_tickets[],
    order_items: OrderItemWithRelations[],

    // Thống kê vé theo loại
    ticket_types: {
        id: string,
        name: string,
        price: number,
        initial_quantity: number,
        remaining_quantity: number,
        sold_quantity: number,
        status: ticket_type_status,
        sold_count: number,
        sold_percentage: number,
        remaining_percentage: number,
    }[],
}