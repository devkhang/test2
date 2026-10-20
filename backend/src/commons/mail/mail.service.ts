import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer/index.js';
import { existsSync } from 'fs';
import { basename, extname } from 'path';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  // Nội dung ngắn in ra console khi chưa cấu hình SMTP (vd. "OTP: 123456")
  devPreview?: string;
  attachments?: Attachment[];
}

export interface MailLogo {
  html: string;               // thẻ <img> (hoặc tên ứng dụng nếu chưa có logo)
  attachments: Attachment[];  // logo nhúng kèm email (cid) – truyền vào send()
}

// Dạng "ten@mien" – Gmail ghép ảnh inline với <img src="cid:..."> ổn định nhất
const LOGO_CID = 'mail-logo@labor-system';

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  get appName(): string {
    return this.configService.get<string>('APP_NAME', 'Hệ thống Quản lý Lao động');
  }

  /**
   * Logo đầu email, ưu tiên:
   * 1. File MAIL_LOGO_PATH (mặc định assets/mail-logo.png; png/jpg/gif) – nhúng thẳng vào email, không cần host ảnh
   * 2. MAIL_LOGO_URL – ảnh public trên mạng
   * 3. Không có → hiện tên ứng dụng
   */
  logo(height = 56): MailLogo {
    const path = this.configService.get<string>('MAIL_LOGO_PATH', 'assets/mail-logo.png');
    const contentType = IMAGE_TYPES[extname(path).toLowerCase()];
    if (contentType && existsSync(path)) {
      return {
        html: `<img src="cid:${LOGO_CID}" alt="${this.appName}" height="${height}" style="display:block;margin:0 auto;height:${height}px;" />`,
        // inline + contentType rõ ràng: ảnh hiện trong nội dung, không bị liệt kê thành tệp đính kèm
        attachments: [{ filename: basename(path), path, cid: LOGO_CID, contentType, contentDisposition: 'inline' }],
      };
    }
    const url = this.configService.get<string>('MAIL_LOGO_URL');
    if (url) {
      return {
        html: `<img src="${url}" alt="${this.appName}" height="${height}" style="display:block;margin:0 auto;height:${height}px;" />`,
        attachments: [],
      };
    }
    return {
      html: `<span style="font-size:18px;font-weight:700;color:#1a73e8;">${this.appName}</span>`,
      attachments: [],
    };
  }

  async send({ to, subject, html, devPreview, attachments }: MailOptions): Promise<void> {
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
      attachments,
    });
  }
}
