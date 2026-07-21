import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, } from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { unlink } from 'node:fs';


interface HttpExceptionResponseBody {
  message?: string | string[];
  errors?: unknown,
  [key: string]: unknown;
}

function isHttpExceptionResponseBody(
  value: unknown,
): value is HttpExceptionResponseBody {
  return typeof value === 'object' && value !== null;
}


@Catch() 
export class GlobalExceptionFilter implements ExceptionFilter {
  
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request =  ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errorCode: string | undefined;
    let details: unknown;

    if(exception instanceof BusinessException) {
      status = exception.getStatus();
      message = exception.message;
      errorCode = exception.errorCode;
    } else if(exception instanceof HttpException) {
      status = exception.getStatus();
      const res: unknown = exception.getResponse();
      if(typeof res === 'string') {
        message = res;
      }else if(isHttpExceptionResponseBody(res)) {
        if(Array.isArray(res.message)) {
          message = res.message.join(', ');
        }else if(typeof res.message === 'string') {
          message = res.message;
        }
        details = res.errors;
      }
    }else if(exception instanceof Error) {
      message = exception.message;
      this.logger.error(message , exception);
    }


    if (status == HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception' , exception as Error);
    }


    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      details,
      path: request.url,
      timestamp: new Date().toISOString()
    });
    
    
  }
  
}

