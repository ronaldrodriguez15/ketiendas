import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { cop } from '../../utils/format';

const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const compact = value => new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const tooltipStyle = { borderRadius: 12, border: '1px solid #dce5df', color: '#173e2b', background: '#fff' };

export default function SalesCharts({ dias, resumen, hasta }) {
  const weekdays = names.map(dia => ({ dia, total: 0, dias: 0, promedio: null }));
  // Noon with an explicit offset keeps the calendar date stable in every browser timezone.
  dias.forEach(day => {
    if (day.fecha === hasta || day.total == null) return;
    const index = (new Date(`${day.fecha}T12:00:00-05:00`).getUTCDay() + 6) % 7;
    weekdays[index].total += day.total;
    weekdays[index].dias += 1;
  });
  weekdays.forEach(day => { day.promedio = day.dias ? Math.round(day.total / day.dias) : null; });
  const available = weekdays.filter(day => day.dias);
  const best = available.reduce((winner, day) => !winner || day.promedio > winner.promedio ? day : winner, null);
  const mix = [
    { name: 'Pagadas', value: resumen.total_cobrado, color: '#16a34a' },
    { name: 'A crédito', value: resumen.total_credito, color: '#d99720' },
  ];
  return <div className="grid gap-4 lg:grid-cols-3">
    <section className="glass p-5 min-w-0 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div><h2 className="font-semibold">¿Qué días se vende más?</h2><p className="text-sm" style={{ color: 'var(--mut)' }}>Venta promedio por día de la semana</p></div>
        {best?.promedio > 0 && <span className="chip">Mayor promedio: {best.dia} · {cop(best.promedio)}</span>}
      </div>
      {available.length ? <div style={{ height: 270 }} role="img" aria-label={`Promedio de ventas por día de la semana. ${available.map(day => `${day.dia}: ${cop(day.promedio)}`).join('. ')}`}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={weekdays} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,163,74,.15)" />
          <XAxis dataKey="dia" tickFormatter={value => value.slice(0, 3)} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis width={58} tickFormatter={compact} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name, item) => [cop(value), `Promedio · ${item.payload.dias} día(s)`]} />
          <Bar dataKey="promedio" name="Promedio" radius={[6, 6, 0, 0]} maxBarSize={44}>{weekdays.map(day => <Cell key={day.dia} fill={day === best ? '#15803d' : '#86cfa3'} />)}</Bar>
        </BarChart></ResponsiveContainer>
      </div> : <p className="py-12 text-center">Todavía no hay días completos para comparar.</p>}
      <p className="text-xs" style={{ color: 'var(--mut)' }}>Promedio de los días disponibles del periodo, incluidos los días sin ventas. Excluye hoy porque aún está en curso. Los días sin datos no se consideran cero.</p>
    </section>
    <section className="glass p-5 min-w-0">
      <h2 className="font-semibold">Pagadas y a crédito</h2>
      <p className="text-sm" style={{ color: 'var(--mut)' }}>Distribución del valor de las ventas</p>
      {resumen.total_ventas > 0 ? <>
        <div style={{ height: 220 }} role="img" aria-label={mix.map(item => `${item.name}: ${cop(item.value)}`).join('. ')}><ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie data={mix} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={3}>{mix.map(item => <Cell key={item.name} fill={item.color} />)}</Pie>
          <Tooltip formatter={value => cop(value)} contentStyle={tooltipStyle} />
        </PieChart></ResponsiveContainer></div>
        <div className="space-y-2">{mix.map(item => <div key={item.name} className="flex flex-wrap justify-between gap-2 text-sm"><span><span aria-hidden="true" style={{ color: item.color }}>● </span>{item.name}</span><strong>{cop(item.value)} · {Math.round(item.value / resumen.total_ventas * 100)}%</strong></div>)}</div>
      </> : <p className="py-12 text-center">No hay ventas para mostrar en este periodo.</p>}
      <p className="text-xs mt-4" style={{ color: 'var(--mut)' }}>Las ventas a crédito muestran su valor original, no el saldo pendiente ni el dinero recaudado.</p>
    </section>
  </div>;
}
