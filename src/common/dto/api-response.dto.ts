export class ApiResponseDto<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    const response = new ApiResponseDto<T>();
    response.success = true;
    response.data = data;
    if (message) response.message = message;
    return response;
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string,
  ): ApiResponseDto<T[]> {
    const response = new ApiResponseDto<T[]>();
    response.success = true;
    response.data = data;
    response.meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
    if (message) response.message = message;
    return response;
  }

  static error(message: string): ApiResponseDto<null> {
    const response = new ApiResponseDto<null>();
    response.success = false;
    response.message = message;
    return response;
  }
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
