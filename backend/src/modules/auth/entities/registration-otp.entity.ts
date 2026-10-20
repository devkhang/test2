import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

// OTP xác thực email khi đăng ký doanh nghiệp – lúc này chưa có user nên lưu bảng riêng
@Index(['email'], { unique: true })
@Entity('registration_otps')
export class RegistrationOtpEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email' })
  email: string;

  @Column({ name: 'tax_code' })
  taxCode: string;

  // Chỉ lưu SHA-256 của OTP
  @Column({ name: 'otp_hash' })
  otpHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  // Số lần nhập sai – quá giới hạn thì phải gửi mã mới
  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'sent_at', type: 'timestamp' })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
