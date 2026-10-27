import { http } from './http';
const options = { staleTime: 30_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false };
export const creditosQuery = filters => ({ ...options, queryKey: ['creditos', filters],
  queryFn: ({ signal }) => http('/creditos?' + new URLSearchParams(filters), { signal }) });
export const detalleCreditoQuery = (id, filters) => ({ ...options, staleTime: 0, queryKey: ['credito-detalle', id, filters],
  queryFn: ({ signal }) => http('/creditos/' + encodeURIComponent(id) + '?' + new URLSearchParams(filters), { signal }) });
