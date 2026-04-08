import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

interface HttpRequest {
  method: string;
  url: string;
}

interface HttpResponse {
  statusCode: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const now = Date.now();

    return next.handle().pipe(
      map((responseData: T) => {
        const response = context.switchToHttp().getResponse<HttpResponse>();
        const request = context.switchToHttp().getRequest<HttpRequest>();
        const duration = Date.now() - now;

        this.logger.debug(
          `${request.method} ${request.url} - ${response.statusCode} [${duration}ms]`,
        );

        // If the response already has the expected shape, return as-is
        if (
          responseData &&
          typeof responseData === 'object' &&
          'success' in responseData
        ) {
          return responseData as ApiResponse<T>;
        }

        // Wrap the response in a standard format
        return {
          success: true,
          data: responseData,
        };
      }),
    );
  }
}
