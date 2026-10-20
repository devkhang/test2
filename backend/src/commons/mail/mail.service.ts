import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  // Nội dung ngắn in ra console khi chưa cấu hình SMTP (vd. "OTP: 123456")
  devPreview?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  get appName(): string {
    return this.configService.get<string>('APP_NAME', 'Hệ thống Quản lý Lao động');
  }

  async send({ to, subject, html, devPreview }: MailOptions): Promise<void> {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    // Môi trường dev chưa điền MAIL_USER/MAIL_PASS: in ra console thay vì gửi để vẫn test được luồng OTP
    if ((!user || !pass) && this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.warn(`[Chưa cấu hình SMTP] Email tới ${to} – "${subject}"${devPreview ? ` – ${devPreview}` : ''}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: Number(this.configService.get('MAIL_PORT', 587)),
      secure: false,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"${this.appName}" <${user}>`,
      to,
      subject,
      html,
    });
  }
}
