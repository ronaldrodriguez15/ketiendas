export interface HttpOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  anonymous?: boolean;
}
export function http<T = unknown>(path: string, options?: HttpOptions): Promise<T>;
export function retry(attempt: number, error: Error & { status?: number }): boolean;
export const tokenStore: { get(): string | null; set(token: string): void; clear(): void };
