import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as argon2 from '@node-rs/argon2';
import * as crypto from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { UserService } from '../user/user.service.js';
import { UserEntity } from '../user/user.entity.js';
import { EnterpriseService } from '../enterprise/enterprise.service.js';
import { EnterpriseEntity } from '../enterprise/enterprise.entity.js';
import { MailService } from '../../commons/mail/mail.service.js';
import { ROLE } from '../../commons/constants/roles.js';
import { RegistrationOtpEntity } from './entities/registration-otp.entity.js';
import {
  SendRegisterOtpDto,
  VerifyRegisterOtpDto,
  RegisterBusinessDto,
  RegisterDto,
} from './dto/register.dto.js';

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;       // khớp đồng hồ đếm ngược ở frontend
const OTP_MAX_ATTEMPTS = 5;
const VERIFY_TOKEN_EXPIRES_IN = '30m';
const VERIFY_TOKEN_PURPOSE = 'register-business';

const FILE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
export const ALLOWED_FILE_TYPES = Object.keys(FILE_EXTENSIONS);
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface RegisterBusinessFiles {
  businessLicense?: Express.Multer.File[];
  otherDocument?: Express.Multer.File[];
}

interface VerifyTokenPayload {
  purpose: typeof VERIFY_TOKEN_PURPOSE;
  email: string;
  taxCode: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectRepository(RegistrationOtpEntity)
    private readonly otpRepository: Repository<RegistrationOtpEntity>,
    private readonly userService: UserService,
    private readonly enterpriseService: EnterpriseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 1. GỬI OTP TỚI EMAIL DOANH NGHIỆP ─────────────────────────────────────
  async sendOtp(dto: SendRegisterOtpDto) {
    const email = dto.email.trim().toLowerCase();
    await this.ensureAvailable(email, dto.taxCode);

    const existing = await this.otpRepository.findOne({ where: { email } });
    if (existing && Date.now() - existing.sentAt.getTime() < OTP_RESEND_SECONDS * 1000) {
      throw new HttpException(
        {
          code: 'OTP_RESEND_TOO_SOON',
          message: `Vui lòng đợi ${OTP_RESEND_SECONDS} giây trước khi gửi lại mã.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const now = new Date();
    await this.otpRepository.save({
      ...(existing ? { id: existing.id } : {}),
      email,
      taxCode: dto.taxCode,
      otpHash: this.hashOtp(otp),
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      sentAt: now,
    });

    await this.mailService.send({
      to: email,
      subject: `[${this.mailService.appName}] Mã xác thực đăng ký tài khoản doanh nghiệp`,
      html: this.otpEmailHtml(otp),
      devPreview: `OTP: ${otp}`,
    });

    return null;
  }

  // ─── 2. XÁC THỰC OTP → TRẢ VERIFY TOKEN ────────────────────────────────────
  async verifyOtp(dto: VerifyRegisterOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const record = await this.otpRepository.findOne({ where: { email } });

    if (!record) {
      throw new BadRequestException({
        code: 'OTP_NOT_REQUESTED',
        message: 'Chưa có yêu cầu gửi mã OTP. Vui lòng bắt đầu lại.',
      });
    }
    if (new Date() > record.expiresAt) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: `Mã OTP đã hết hạn sau ${OTP_EXPIRY_MINUTES} phút. Vui lòng yêu cầu mã mới.`,
      });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'OTP_TOO_MANY_ATTEMPTS',
        message: 'Nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.',
      });
    }
    if (!this.safeEqual(record.otpHash, this.hashOtp(dto.otp))) {
      await this.otpRepository.increment({ id: record.id }, 'attempts', 1);
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Mã OTP không đúng. Vui lòng kiểm tra lại.',
      });
    }

    // OTP chỉ dùng một lần
    await this.otpRepository.delete({ id: record.id });

    const payload: VerifyTokenPayload = {
      purpose: VERIFY_TOKEN_PURPOSE,
      email,
      taxCode: record.taxCode,
    };
    const verifyToken = this.jwtService.sign(payload, {
      secret: this.verifyTokenSecret(),
      expiresIn: VERIFY_TOKEN_EXPIRES_IN,
    });

    return { verifyToken };
  }

  // ─── 3. TẠO TÀI KHOẢN DOANH NGHIỆP ─────────────────────────────────────────
  // Tên đăng nhập = mã số thuế; mật khẩu tạm trả về 1 lần và gửi qua email
  async registerBusiness(dto: RegisterBusinessDto, files: RegisterBusinessFiles) {
    const email = dto.email.trim().toLowerCase();
    this.checkVerifyToken(dto.verifyToken, email, dto.taxCode);

    const license = files.businessLicense?.[0];
    const other = files.otherDocument?.[0];
    if (!license) {
      throw new BadRequestException({
        code: 'LICENSE_REQUIRED',
        message: 'Vui lòng tải lên Giấy phép kinh doanh',
      });
    }

    await this.ensureAvailable(email, dto.taxCode);

    const tempPassword = this.generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword);

    const licensePath = await this.storeFile(license, dto.taxCode);
    const otherPath = other ? await this.storeFile(other, dto.taxCode) : null;

    try {
      await this.dataSource.transaction(async (manager) => {
        const enterprise = await manager.save(
          manager.create(EnterpriseEntity, {
            companyName: dto.companyName.trim(),
            taxCode: dto.taxCode,
            businessType: dto.businessType,
            mainIndustry: dto.mainIndustry,
            licenseDate: dto.licenseDate,
            provinceId: dto.province,
            wardId: dto.ward,
            address: dto.address,
            foreignName: dto.foreignName ?? null,
            email,
            officePhone: dto.officePhone ?? null,
            leaderName: dto.leaderName ?? null,
            leaderPhone: dto.leaderPhone ?? null,
            operatingProvinceId: dto.operatingProvince ?? null,
            operatingWardId: dto.operatingWard ?? null,
            businessLocation: dto.businessLocation ?? null,
            businessLicensePath: licensePath,
            businessLicenseName: license.originalname,
            otherDocumentPath: otherPath,
            otherDocumentName: other?.originalname ?? null,
          }),
        );

        await manager.save(
          manager.create(UserEntity, {
            username: dto.taxCode,
            passwordHash,
            fullName: dto.companyName.trim(),
            email,
            phoneNumber: dto.officePhone || dto.leaderPhone || null,
            provinceId: dto.province,
            wardId: dto.ward,
            address: dto.address,
            roleId: ROLE.ENTERPRISE,
            enterpriseId: enterprise.id,
            isActive: true,
          }),
        );
      });
    } catch (err) {
      await Promise.all([licensePath, otherPath].filter((p): p is string => !!p).map((p) => this.removeFile(p)));
      throw this.translateUniqueViolation(err);
    }

    // Gửi mail không thành công thì tài khoản vẫn đã tạo – người dùng thấy mật khẩu ở popup
    try {
      await this.mailService.send({
        to: email,
        subject: `[${this.mailService.appName}] Thông tin tài khoản doanh nghiệp`,
        html: this.accountEmailHtml(dto.companyName.trim(), dto.taxCode, tempPassword),
        devPreview: `Tài khoản: ${dto.taxCode} / ${tempPassword}`,
      });
    } catch (err) {
      this.logger.error(`Không gửi được email tài khoản tới ${email}`, err as Error);
    }

    return {
      username: dto.taxCode,
      tempPassword,
      companyName: dto.companyName.trim(),
      email,
    };
  }

  // ─── ĐĂNG KÝ THƯỜNG (trang /signup) – tự chọn tên đăng nhập & mật khẩu ─────
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.userService.findByUsername(dto.username)) {
      throw new ConflictException({ code: 'USERNAME_EXISTS', message: 'Tên đăng nhập đã tồn tại' });
    }
    await this.ensureAvailable(email, dto.taxCode);

    const passwordHash = await argon2.hash(dto.password);
    try {
      await this.dataSource.transaction(async (manager) => {
        const enterprise = await manager.save(
          manager.create(EnterpriseEntity, {
            companyName: dto.companyName.trim(),
            taxCode: dto.taxCode,
            email,
            officePhone: dto.phone,
          }),
        );
        await manager.save(
          manager.create(UserEntity, {
            username: dto.username,
            passwordHash,
            fullName: dto.companyName.trim(),
            email,
            phoneNumber: dto.phone,
            roleId: ROLE.ENTERPRISE,
            enterpriseId: enterprise.id,
            isActive: true,
          }),
        );
      });
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
    return null;
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  /** MST chưa có tài khoản/hồ sơ, email chưa được dùng */
  private async ensureAvailable(email: string, taxCode: string) {
    const [userByTaxCode, enterprise, userByEmail] = await Promise.all([
      this.userService.findByUsername(taxCode),
      this.enterpriseService.findByTaxCode(taxCode),
      this.userService.findByEmail(email),
    ]);
    if (userByTaxCode || enterprise) {
      throw new ConflictException({ code: 'TAX_CODE_EXISTS', message: 'Mã số thuế đã được đăng ký' });
    }
    if (userByEmail) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email đã được sử dụng' });
    }
  }

  private checkVerifyToken(token: string, email: string, taxCode: string) {
    try {
      const payload = this.jwtService.verify<VerifyTokenPayload>(token, {
        secret: this.verifyTokenSecret(),
      });
      if (payload.purpose === VERIFY_TOKEN_PURPOSE && payload.email === email && payload.taxCode === taxCode) {
        return;
      }
    } catch {
      // rơi xuống lỗi chung bên dưới
    }
    throw new BadRequestException({
      code: 'VERIFY_TOKEN_INVALID',
      message: 'Phiên xác thực email không hợp lệ hoặc đã hết hạn. Vui lòng xác thực lại.',
    });
  }

  // Khác secret của access token: verify token không thể dùng để đăng nhập
  private verifyTokenSecret(): string {
    return `${this.configService.get<string>('JWT_SECRET', 'default-secret-change-me')}:${VERIFY_TOKEN_PURPOSE}`;
  }

  /** Lỗi unique của Postgres (đăng ký trùng cùng lúc) → 409 có mã nghiệp vụ */
  private translateUniqueViolation(err: unknown): unknown {
    if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === '23505') {
      return new ConflictException({ code: 'ACCOUNT_EXISTS', message: 'Tài khoản đã tồn tại' });
    }
    return err;
  }

  private async storeFile(file: Express.Multer.File, taxCode: string): Promise<string> {
    const dir = join(this.configService.get<string>('UPLOAD_DIR', 'uploads'), 'enterprises');
    await mkdir(dir, { recursive: true });
    const name = `${taxCode}-${crypto.randomUUID()}.${FILE_EXTENSIONS[file.mimetype]}`;
    const path = join(dir, name);
    await writeFile(path, file.buffer);
    return path;
  }

  private async removeFile(path: string) {
    await unlink(path).catch(() => undefined);
  }

  private generateOtp(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /** 10 ký tự, luôn có chữ hoa, chữ thường và số; bỏ ký tự dễ nhầm (0/O, 1/l/I) */
  private generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (set: string) => set[crypto.randomInt(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits)];
    while (chars.length < 10) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private otpEmailHtml(otp: string): string {
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
  <h2 style="color:#1a73e8;">${this.mailService.appName}</h2>
  <p>Mã xác thực đăng ký tài khoản doanh nghiệp của bạn là:</p>
  <p style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1a73e8;font-family:'Courier New',monospace;">${otp}</p>
  <p>Mã có hiệu lực trong <strong>${OTP_EXPIRY_MINUTES} phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
  <p style="color:#9ca3af;font-size:12px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
</div>`;
  }

  private accountEmailHtml(companyName: string, username: string, tempPassword: string): string {
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
  <h2 style="color:#1a73e8;">${this.mailService.appName}</h2>
  <p>Tài khoản doanh nghiệp <strong>${this.escapeHtml(companyName)}</strong> đã được tạo thành công.</p>
  <p>Tên đăng nhập: <strong>${username}</strong><br/>
     Mật khẩu tạm thời: <strong style="font-family:'Courier New',monospace;">${tempPassword}</strong></p>
  <p>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
</div>`;
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }
}
