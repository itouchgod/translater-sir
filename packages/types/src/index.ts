export type ApiResponse<TData, TMeta = Record<string, unknown>> = {
  data: TData | null;
  error: string | null;
  meta?: TMeta;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
};
