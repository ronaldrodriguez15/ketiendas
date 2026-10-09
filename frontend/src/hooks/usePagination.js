import { useState } from "react";

export function usePagination(items, initialSize = 8) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageSize,
    totalPages,
    totalItems: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    setPage,
    setPageSize: (n) => { setPageSize(n); setPage(1); },
  };
}
