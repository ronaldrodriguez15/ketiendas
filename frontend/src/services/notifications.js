import { toast } from 'react-toastify';
export const notify = {
  success: (message) => toast.success(message, { toastId: `success:${message}` }),
  info: (message) => toast.info(message, { toastId: `info:${message}` }),
  warning: (message) => toast.warn(message, { toastId: `warning:${message}` }),
  error: (error) => {
    if (error?.name === 'AbortError' || error?.status === 401) return;
    const message = error instanceof TypeError ? 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.' : error?.message || 'No se pudo completar la solicitud.';
    toast.error(message, { toastId: `error:${message}`, autoClose: 6500 });
  },
};
