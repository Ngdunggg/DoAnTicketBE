import { Decimal } from '@prisma/client/runtime/library';
import { purchased_tickets_status, orders_status } from 'generated/prisma';

export interface OrderWithItems {
    id: string;
    user_id: string;
    buyer_email: string;
    total_amount: Decimal;
    status: orders_status;
    order_items: OrderItemWithTicketType[];
    users: {
        full_name: string;
    };
}

export interface OrderItemWithTicketType {
    id: string;
    ticket_type_id: string;
    quantity: number;
    ticket_types: {
        id: string;
        name: string;
        price: Decimal;
        event_id: string;
        event_date_id: string | null;
        events: {
            id: string;
            title: string;
            start_time: Date;
        };
        event_dates: {
            id: string;
            start_at: Date;
            end_at: Date;
        } | null;
    };
}

export interface PurchasedTicket {
    id: string;
    ticket_type_id: string;
    buyer_id: string;
    order_id: string;
    event_id: string;
    serial_number: string;
    price: Decimal;
    status: purchased_tickets_status;
    created_at: Date;
}

