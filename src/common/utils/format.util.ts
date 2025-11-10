export class FormatUtil {
    /**
     * Tính phần trăm
     */
    static calculatePercentage(part: number, total: number): number {
        return total > 0 ? Math.round((part / total) * 100) : 0;
    }
    
    /**
     * Sắp xếp mảng theo ngày (từ mới đến cũ)
     */
    static sortByDate<T extends { date: Date }>(items: T[]): T[] {
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    /**
     * Làm tròn số
     */
    static roundNumber(num: number): number {
        return Math.round(num);
    }
    
    /**
     * Xử lý location null
     */
    static formatLocation(location: string | null): string {
        return location || 'Chưa cập nhật';
    }
}
