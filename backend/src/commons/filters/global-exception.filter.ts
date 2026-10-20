import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Mã lỗi mặc định theo HTTP status khi service không gắn `code` riêng
const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'FILE_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

/**
 * Body lỗi: { success: false, statusCode, code, message, timestamp, path }
 * - code: mã nghiệp vụ (vd. WRONG_PASSWORD) – frontend dịch theo `errors.<code>`
 * - message: câu tiếng Việt để hiển thị trực tiếp
 * Service gắn code bằng cách ném: new BadRequestException({ code: 'OTP_INVALID', message: '...' })
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Lỗi máy chủ nội bộ';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as { message?: string | string[]; code?: string };
        message = body.message || exception.message;
        code = body.code;
        // Lỗi từ ValidationPipe: message là mảng các lỗi trường
        if (!code && statusCode === 400 && Array.isArray(body.message)) {
          code = 'VALIDATION_ERROR';
        }
      }
    } else {
      this.logger.error('Unhandled exception', exception);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      code: code ?? DEFAULT_CODES[statusCode] ?? 'ERROR',
      message: Array.isArray(message) ? message.join(', ') : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
