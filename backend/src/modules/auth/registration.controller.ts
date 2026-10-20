import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../../commons/decorators/public.decorator.js';
import {
  RegistrationService,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  type RegisterBusinessFiles,
} from './registration.service.js';
import {
  SendRegisterOtpDto,
  VerifyRegisterOtpDto,
  RegisterBusinessDto,
  RegisterBusinessSwaggerBody,
  RegisterDto,
} from './dto/register.dto.js';

// Luồng đăng ký doanh nghiệp (frontend: BusinessRegisterDialog):
//   send-otp → verify-otp (nhận verifyToken) → register-business (multipart, kèm file)
@ApiTags('Auth – Đăng ký')
@Public()
@Controller('auth')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('register-business/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng ký doanh nghiệp – B1: gửi OTP',
    description: 'Kiểm tra MST/email chưa được dùng rồi gửi mã OTP 6 số về email. Gửi lại sau 60 giây.',
  })
  sendOtp(@Body() dto: SendRegisterOtpDto) {
    return this.registrationService.sendOtp(dto);
  }

  @Post('register-business/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng ký doanh nghiệp – B2: xác thực OTP',
    description: 'OTP đúng → trả verifyToken (hiệu lực 30 phút) dùng cho bước gửi hồ sơ.',
  })
  verifyOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.registrationService.verifyOtp(dto);
  }

  @Post('register-business')
  @ApiOperation({
    summary: 'Đăng ký doanh nghiệp – B3: gửi hồ sơ và tạo tài khoản',
    description:
      'multipart/form-data. Tên đăng nhập = mã số thuế; trả về mật khẩu tạm (đồng thời gửi qua email). ' +
      'File: pdf/jpg/png, tối đa 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegisterBusinessSwaggerBody })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'businessLicense', maxCount: 1 },
        { name: 'otherDocument', maxCount: 1 },
      ],
      {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (_req, file, cb) => {
          if (ALLOWED_FILE_TYPES.includes(file.mimetype)) return cb(null, true);
          cb(
            new BadRequestException({
              code: 'INVALID_FILE_TYPE',
              message: 'Chỉ chấp nhận file PDF, JPG hoặc PNG',
            }),
            false,
          );
        },
      },
    ),
  )
  registerBusiness(
    @Body() dto: RegisterBusinessDto,
    @UploadedFiles() files: RegisterBusinessFiles = {},
  ) {
    return this.registrationService.registerBusiness(dto, files);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký thường (trang /signup)',
    description: 'Tự chọn tên đăng nhập và mật khẩu; tạo hồ sơ doanh nghiệp tối thiểu.',
  })
  register(@Body() dto: RegisterDto) {
    return this.registrationService.register(dto);
  }
}
