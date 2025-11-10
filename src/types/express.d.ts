import { user_role } from 'generated/prisma';

declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            full_name: string;
            avatar_url?: string | null;
            google_id?: string | null;
            phone?: string | null;
            gender?: boolean | null;
            date_of_birth?: Date | null;
            role: user_role;
            password?: string | null;
        }
    }
}
