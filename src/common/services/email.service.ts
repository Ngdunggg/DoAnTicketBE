import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as QRCode from 'qrcode';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }

    async sendOtpEmail(email: string, otp: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Xác thực tài khoản - Mã OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Xác thực tài khoản</h2>
                        <p>Xin chào,</p>
                        <p>Bạn đã đăng ký tài khoản. Vui lòng sử dụng mã OTP sau để xác thực:</p>
                        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
                        </div>
                        <p>Mã này sẽ hết hạn sau 5 phút.</p>
                        <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">Email này được gửi tự động, vui lòng không trả lời.</p>
                    </div>
                `,
            };

            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }

    async sendTicketConfirmation(data: {
        to: string;
        buyer_name: string;
        order_id: string;
        tickets: Array<{
            id: string;
            serial_number: string;
            qr_data: string;
            event_title: string;
            event_date: Date;
            ticket_type_name: string;
        }>;
    }): Promise<boolean> {
        try {
            // Tạo QR và nhúng bằng CID để tương thích Gmail/đa số email client
            const qrItems = await Promise.all(
                data.tickets.map(async (ticket, index) => {
                    const qrBuffer = await QRCode.toBuffer(ticket.qr_data, {
                        type: 'png',
                        width: 300,
                        margin: 2,
                        errorCorrectionLevel: 'H',
                    });
                    const cid = `ticket-${ticket.id || ticket.serial_number || index}@qr`;
                    return {
                        ...ticket,
                        qrBuffer,
                        cid,
                    };
                })
            );

            const formatDate = (date: Date) => {
                return new Date(date).toLocaleString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            };

            const qrCodesHTML = qrItems
                .map(
                (item, index) => {
                    const ticketData = data.tickets[index];
                    return `
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px;">
                    <h3>Vé #${index + 1}</h3>
                    <p><strong>Tên sự kiện:</strong> ${ticketData.event_title}</p>
                    <p><strong>Ngày tổ chức:</strong> ${formatDate(ticketData.event_date)}</p>
                    <p><strong>Loại vé:</strong> ${ticketData.ticket_type_name}</p>
                    <p><strong>Mã vé:</strong> ${item.serial_number}</p>
                    <p><strong>ID vé:</strong> ${item.id}</p>
                    <div style="text-align: center; margin: 15px 0;">
                    <img src="cid:${item.cid}" alt="QR Code" style="width: 200px; height: 200px;" />
                    </div>
                </div>
                `;
                }
                )
                .join('');

            const attachments = qrItems.map((item, index) => ({
                filename: `ticket-${item.serial_number || item.id || index}.png`,
                content: item.qrBuffer,
                contentType: 'image/png',
                cid: item.cid,
            }));

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: data.to,
                subject: `Xác nhận mua vé thành công - Đơn hàng #${data.order_id}`,
                html: `
                    <div style="font-family: Arial, sans-serif; text-size: 18px ; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #28a745; text-size: 20px;">Mua vé thành công!</h2>
                        <p>Xin chào <strong>${data.buyer_name}</strong>,</p>
                        <p>Cảm ơn bạn đã mua vé! Đơn hàng <strong>#${data.order_id}</strong> của bạn đã được xử lý thành công.</p>
                        
                        <h3 style="color: #333; margin-top: 30px;">Vé điện tử của bạn:</h3>
                        <p>Vui lòng lưu giữ các mã QR dưới đây để sử dụng khi tham gia sự kiện:</p>
                        
                        ${qrCodesHTML}
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="color: #333; margin: 0 0 10px 0;">Hướng dẫn sử dụng:</h4>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li>Lưu giữ email này hoặc chụp ảnh màn hình mã QR</li>
                                <li>Hiển thị mã QR tại cổng vào sự kiện</li>
                                <li>Mỗi mã QR chỉ có thể sử dụng một lần</li>
                                <li>Liên hệ hỗ trợ nếu có vấn đề: support@example.com</li>
                            </ul>
                        </div>
                        
                        <hr>
                        <p style="color: #666; font-size: 14px;">Email này được gửi tự động, vui lòng không trả lời.</p>
                    </div>
                `,
                attachments,
            };

            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending ticket confirmation email:', error);
            return false;
        }
    }
}
