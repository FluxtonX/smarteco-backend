import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error: string = 'InternalServerError';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
                error = exception.name;
            } else if (typeof exceptionResponse === 'object') {
                const resp = exceptionResponse as { message?: string | string[]; error?: string };
                message = resp.message || exception.message;
                error = resp.error || exception.name;
            }
        } else if (exception instanceof Error) {
            // Log unexpected errors with stack trace
            this.logger.error(
                `Unexpected error: ${exception.message}`,
                exception.stack,
            );
        }

        const errorResponse = {
            success: false,
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        };

        response.status(status).json(errorResponse);
    }
}
