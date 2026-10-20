import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsDateString,
  Length,
  IsNumberString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Khớp kiểm tra ở frontend (BusinessInfoStep.tsx)
const TAX_CODE_RE = /^\d{10}(-\d{3})?$/;
const PHONE_RE = /^0\d{9}$/;
const TAX_CODE_MESSAGE = 'Mã số thuế gồm 10 số (chi nhánh: 10 số-3 số)';
const PHONE_MESSAGE = 'Số điện thoại gồm 10 số, bắt đầu bằng 0';

// ─── ĐĂNG KÝ DOANH NGHIỆP – BƯỚC 1: GỬI OTP ─────────────────────────────────
export class SendRegisterOtpDto {
  @ApiProperty({ example: 'contact@congty.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '0101234567' })
  @Matches(TAX_CODE_RE, { message: TAX_CODE_MESSAGE })
  taxCode: string;
}

// ─── ĐĂNG KÝ DOANH NGHIỆP – BƯỚC 2: XÁC THỰC OTP ────────────────────────────
export class VerifyRegisterOtpDto {
  @ApiProperty({ example: 'contact@congty.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsNumberString({}, { message: 'Mã OTP chỉ gồm chữ số' })
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  otp: string;
}

// ─── ĐĂNG KÝ DOANH NGHIỆP – BƯỚC 3: GỬI HỒ SƠ (multipart/form-data) ─────────
// File businessLicense / otherDocument đi riêng qua FileFieldsInterceptor
export class RegisterBusinessDto {
  @ApiProperty({ description: 'Token nhận được ở bước xác thực OTP' })
  @IsString()
  @IsNotEmpty()
  verifyToken: string;

  @ApiProperty({ example: 'Công ty TNHH ABC' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên doanh nghiệp' })
  companyName: string;

  @ApiProperty({ example: '0101234567' })
  @Matches(TAX_CODE_RE, { message: TAX_CODE_MESSAGE })
  taxCode: string;

  @ApiProperty({ example: 'company' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn loại hình kinh doanh' })
  businessType: string;

  @ApiProperty({ example: 'manufacturing' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn ngành nghề kinh doanh chính' })
  mainIndustry: string;

  @ApiProperty({ example: '2020-01-15', description: 'YYYY-MM-DD' })
  @IsDateString({}, { message: 'Ngày cấp GPKD không hợp lệ' })
  licenseDate: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn tỉnh/thành phố' })
  province: string;

  @ApiProperty({ example: '26734' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn phường/xã' })
  ward: string;

  @ApiProperty({ example: '162 đường số 2' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ' })
  address: string;

  @ApiProperty({ example: 'contact@congty.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  foreignName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leaderName?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @Matches(PHONE_RE, { message: PHONE_MESSAGE })
  leaderPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatingProvince?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatingWard?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessLocation?: string;
}

// Chỉ dùng cho Swagger: hiển thị ô chọn file trong form multipart
export class RegisterBusinessSwaggerBody extends RegisterBusinessDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Giấy phép kinh doanh (bắt buộc) – pdf/jpg/png' })
  businessLicense: unknown;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Giấy tờ khác – pdf/jpg/png' })
  otherDocument?: unknown;
}

// ─── ĐĂNG KÝ THƯỜNG (trang /signup) ─────────────────────────────────────────
export class RegisterDto {
  @ApiProperty({ example: 'Công ty TNHH ABC' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên doanh nghiệp' })
  companyName: string;

  @ApiProperty({ example: '0101234567' })
  @Matches(TAX_CODE_RE, { message: TAX_CODE_MESSAGE })
  taxCode: string;

  @ApiProperty({ example: 'contact@congty.vn' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(PHONE_RE, { message: PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'congtyabc' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @ApiProperty({ example: 'MatKhau@123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;
}
