import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, retry } from './http';
export function useUsuarios(filters) {
  return useQuery({ queryKey: ['usuarios', filters], queryFn: ({ signal }) => http(`/usuarios?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''))}`, { signal }), placeholderData: keepPreviousData, retry });
}
function useGuardar(method) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }) => http(`/usuarios${id ? `/${id}` : ''}`, { method, body }), onSuccess: () => client.invalidateQueries({ queryKey: ['usuarios'] }) });
}
export const useCrearUsuario = () => useGuardar('POST');
export const useEditarUsuario = () => useGuardar('PUT');
export function useEliminarUsuario() {
  const client = useQueryClient();
  return useMutation({ mutationFn: id => http(`/usuarios/${id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['usuarios'] }) });
}
export function useCambiarActivo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }) => http(`/usuarios/${id}/activo`, { method: 'PATCH', body: { activo } }),
    onMutate: async ({ id, activo }) => {
      await client.cancelQueries({ queryKey: ['usuarios'] });
      const previous = client.getQueriesData({ queryKey: ['usuarios'] });
      client.setQueriesData({ queryKey: ['usuarios'] }, old => old ? { ...old, data: old.data.map(user => user.id === id ? { ...user, activo } : user) } : old);
      return { previous };
    },
    onError: (_error, _variables, context) => context?.previous.forEach(([key, value]) => client.setQueryData(key, value)),
    onSettled: () => client.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
