import { queryOptions } from '@tanstack/react-query';
import { http } from './http';
import { shiftDate } from '../utils/salesDates';
import { mergeSalesSummaries } from '../utils/mergeSalesSummaries';
export const resumenVentasQuery = (filters) => queryOptions({
  queryKey: ['ventas', 'resumen', filters], staleTime: 30_000, retry: false,
  queryFn: async ({ signal }) => {
    // Overlap two requests without sending the entire month at once.
    const ranges = [];
    for (let desde = filters.desde; desde <= filters.hasta; desde = shiftDate(desde, 5)) {
      const hasta = shiftDate(desde, 4) < filters.hasta ? shiftDate(desde, 4) : filters.hasta;
      ranges.push({ ...filters, desde, hasta });
    }
    const summaries = new Array(ranges.length);
    let next = 0;
    let failed = false;
    const worker = async () => {
      while (!failed && next < ranges.length) {
        signal?.throwIfAborted();
        const index = next++;
        try {
          summaries[index] = await http('/ventas/resumen?' + new URLSearchParams(ranges[index]), { signal });
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, ranges.length) }, worker));
    return mergeSalesSummaries(summaries, filters);
  },
});
export const ventasQuery = (filters) => queryOptions({
  queryKey: ['ventas', filters], staleTime: 30_000, retry: false,
  queryFn: ({ signal }) => http(`/ventas?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v != null))}`, { signal }),
});
