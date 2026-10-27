import { queryOptions } from '@tanstack/react-query';
import { http } from './http';

export interface Supplier {
  person_id: number;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone_number: string;
  account_number: string;
  address_1: string;
  city: string;
  balance: number | null;
}
export interface Customer extends Supplier {
  credit_limit: number | null;
  points: number | null;
}
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
export type ContactKind = 'customers' | 'suppliers';
export type Contact = Customer | Supplier;
export type SortColumn = 'person_id' | 'first_name' | 'last_name' | 'company_name' | 'email' | 'phone_number' | 'account_number' | 'balance';
export interface ContactFilters {
  search: string;
  search_field: string;
  sort_col: SortColumn;
  sort_dir: 'asc' | 'desc';
  page: number;
  per_page: number;
}
// The shared backend owns connection retries; do not replay slow POS requests.
const retry = false;
export const contactosQuery = (kind: ContactKind, filters: ContactFilters) => queryOptions({
  queryKey: ['contactos', kind, filters], staleTime: 30_000, retry,
  queryFn: ({ signal }): Promise<PaginatedResponse<Contact>> => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    return http(`/${kind}?${params}`, { signal });
  },
});
export const contactoQuery = (kind: ContactKind, id: number) => queryOptions({
  queryKey: ['contactos', kind, 'detalle', id], staleTime: 30_000, retry,
  queryFn: ({ signal }): Promise<{ data: Contact }> => http(`/${kind}/${id}`, { signal }),
});
