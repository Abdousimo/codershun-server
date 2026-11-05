export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function getPaginationSkip(page: number = 1, pageSize: number = 25): number {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return (safePage - 1) * safePageSize;
}

export function createPaginationMeta(page: number = 1, pageSize: number = 25, total: number = 0): PaginationMeta {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.ceil(total / safePageSize),
  };
}
