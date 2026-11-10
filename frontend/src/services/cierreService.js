import { useQuery } from '@tanstack/react-query';
import { http } from './http';

export function useCierre(fecha) {
  return useQuery({ queryKey: ['cierre', fecha], queryFn: ({ signal }) => http(`/cierre?${new URLSearchParams({ fecha })}`, { signal }), staleTime: 120_000, retry: false, enabled: Boolean(fecha) });
}
