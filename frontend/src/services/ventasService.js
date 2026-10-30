import { queryOptions } from '@tanstack/react-query';
import { http } from './http';
export const resumenVentasQuery = (filters) => queryOptions({
  queryKey: ['ventas', 'resumen', filters], staleTime: 120_000, gcTime: 1_800_000, retry: false,
  refetchOnWindowFocus: false,
  queryFn: async ({ signal }) => {
    return http('/ventas/resumen?' + new URLSearchParams(filters), { signal });
  },
});
export const ventasQuery = (filters) => queryOptions({
  queryKey: ['ventas', filters], staleTime: 30_000, retry: false,
  queryFn: ({ signal }) => http(`/ventas?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v != null))}`, { signal }),
});
