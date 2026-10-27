const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
export const tokenStore = {
  get: () => sessionStorage.getItem('panel_token'),
  set: (token) => sessionStorage.setItem('panel_token', token),
  clear: () => sessionStorage.removeItem('panel_token'),
};
export const retry = (n, error) => ![401, 403].includes(error.status) && n < 2;
export async function http(path, { method = 'GET', body, signal, anonymous = false } = {}) {
  const token = anonymous ? null : tokenStore.get();
  const response = await fetch(`${base}${path}`, { method, signal, credentials: 'omit', headers: {
    Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !anonymous && token === tokenStore.get()) {
      tokenStore.clear(); window.dispatchEvent(new Event('session-expired'));
    }
    const error = new Error(payload?.message || 'No se pudo completar la solicitud. Intenta de nuevo.');
    error.status = response.status; error.campos = response.status === 422 ? payload?.errors || {} : {};
    throw error;
  }
  return payload;
}
