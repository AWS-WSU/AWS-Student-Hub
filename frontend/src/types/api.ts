export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success?: false;
  error?: string;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  success: boolean;
  pagination: {
    currentPage?: number;
    page?: number;
    totalPages: number;
    totalUsers?: number;
    total?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
  data?: T[];
}
