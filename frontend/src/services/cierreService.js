import { useQuery } from '@tanstack/react-query';
import { http } from './http';

export function useCierre(fecha) {
  return useQuery({ queryKey: ['cierre', fecha], queryFn: ({ signal }) => http(`/cierre?${new URLSearchParams({ fecha })}`, { signal }), staleTime: 30_000, enabled: Boolean(fecha) });
}
