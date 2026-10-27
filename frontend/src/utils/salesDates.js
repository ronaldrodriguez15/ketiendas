export function todayBogota() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const shiftDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const saleAge = (date, today = todayBogota()) => Math.floor((Date.parse(today) - Date.parse(date.slice(0, 10))) / 86400000);
export const salesLink = (filters) => `/ventas?${new URLSearchParams(filters)}`;
export const shortDate = date => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
