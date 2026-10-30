import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cop } from '../../utils/format';
import { shortDate } from '../../utils/salesDates';
export default function SalesEvolution({ dias }) {
  return (
          <div style={{ height: 300 }} aria-label="Gráfico de ventas del periodo"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dias}>
            <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,163,74,.15)" vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={value => value.slice(8)} axisLine={false} tickLine={false} tick={{ fill: '#5b7566', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: '#5b7566', fontSize: 12 }} tickFormatter={value => value >= 1000000 ? `${value / 1000000}M` : value >= 1000 ? `${value / 1000}k` : value} />
            <Tooltip labelFormatter={shortDate} formatter={value => cop(value)} contentStyle={{ borderRadius: 12, border: 'none' }} />
            <Area type="monotone" dataKey="total" name="Total ventas" stroke="#16a34a" strokeWidth={3} fill="url(#gv)" />
            <Area type="monotone" dataKey="credito" name="Ventas a crédito" stroke="#b7791f" fill="transparent" strokeWidth={2} />
          </AreaChart></ResponsiveContainer></div>
  );
}
