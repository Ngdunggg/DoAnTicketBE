import { users } from 'generated/prisma';

/**
 * Loại bỏ password khỏi user object
 */
export function excludePassword(user: users): Omit<users, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

/**
 * Loại bỏ password khỏi array of users
 */
export function excludePasswordFromUsers(users: users[]): Omit<users, 'password'>[] {
    return users.map((user) => excludePassword(user));
}
