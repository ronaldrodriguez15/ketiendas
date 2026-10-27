import type { ReactNode } from 'react';

export default function DataValue({ value }: { value?: ReactNode }) {
  const missing = value == null || (typeof value === 'string' && (!value.trim() || ['--', '—', '-'].includes(value.trim())));
  return missing ? <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap" style={{ background: '#f1f5f4', color: '#596b63', borderColor: '#dce5e0', lineHeight: 1.25 }}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: '#91a69b' }} />Sin información</span> : <>{value}</>;
}
