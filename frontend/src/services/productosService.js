import { http } from './http';
import { todayBogota } from '../utils/salesDates';

export const productosQuery = periodo => ({
  queryKey: ['productos', todayBogota(), periodo],
  staleTime: 120_000,
  gcTime: 1_800_000,
  retry: false,
  queryFn: ({ signal }) => http('/reportes/productos?' + new URLSearchParams({ periodo }), { signal }),
});
