import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw, ShoppingBag, Trophy, Search } from 'lucide-react';
import { productosQuery } from '../../services/productosService';
import { shortDate } from '../../utils/salesDates';
import './productos.css';

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
const updated = value => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const colors = ['#166534', '#278773', '#529f8e', '#87b7a4', '#cda45c', '#dfe9e1'];
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function ProductCharts({ rows, total }) {
  const leaders = rows.slice(0, 10);
  const shares = rows.slice(0, 5).map((row, index) => ({ name: row.nombre, value: row.cantidad, color: colors[index] }));
  const remaining = Math.max(0, total - shares.reduce((sum, row) => sum + row.value, 0));
  if (remaining > 0) shares.push({ name: 'Otros productos', value: remaining, color: colors[5] });
  let offset = 0;
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="glass p-5 min-w-0" aria-labelledby="product-bars-title">
      <h2 id="product-bars-title" className="font-semibold">Los 10 más vendidos</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--mut)' }}>Unidades vendidas en el periodo</p>
      <div className="space-y-3">{leaders.map((row, index) => <div key={row.id}>
        <div className="flex justify-between items-baseline gap-3 text-sm mb-1"><span className="truncate" title={row.nombre}>{index + 1}. {row.nombre}</span><strong className="tabular-nums shrink-0">{number.format(row.cantidad)}</strong></div>
        <div className="product-bar-track" aria-hidden="true"><div className="product-bar" style={{ width: `${row.cantidad / leaders[0].cantidad * 100}%` }} /></div>
      </div>)}</div>
    </section>
    <section className="glass p-5 min-w-0" aria-labelledby="product-share-title">
      <h2 id="product-share-title" className="font-semibold">Participación en las unidades</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--mut)' }}>Los 5 principales frente al total de productos</p>
      <div className="product-donut">
        <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          {shares.map(row => {
            const share = row.value / total * 100;
            const start = offset; offset += share;
            return <circle key={row.name + start} cx="100" cy="100" r="76" fill="none" stroke={row.color} strokeWidth="24" pathLength="100"
              strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 100 100)" />;
          })}
        </svg>
        <div className="product-donut-label"><strong>{number.format(total)}</strong><span>unidades</span></div>
      </div>
      <ul className="space-y-2 text-sm">{shares.map((row, index) => <li key={index} className="flex items-center gap-2">
        <span className="product-legend-dot" style={{ background: row.color }} aria-hidden="true" /><span className="truncate flex-1" title={row.name}>{row.name}</span>
        <strong className="tabular-nums">{number.format(Math.round(row.value / total * 1000) / 10)} %</strong>
      </li>)}</ul>
    </section>
  </div>;
}

export default function Productos() {
  const [period, setPeriod] = useState('dia');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const result = useQuery(productosQuery(period));
  const { data: rows = [], resumen, meta } = result.data || {};
  const query = normalize(search.trim());
  const filtered = rows.map((row, index) => ({ ...row, puesto: index + 1 })).filter(row => normalize(`${row.nombre} ${row.codigo} ${row.categoria}`).includes(query));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const stats = resumen ? [
    { label: 'Unidades vendidas', value: number.format(resumen.unidades), icon: Package, note: 'Total de todos los productos' },
    { label: 'Productos vendidos', value: number.format(resumen.productos), icon: ShoppingBag, note: `${number.format(resumen.ventas)} ventas con productos` },
    { label: 'Producto líder', value: rows[0]?.nombre || 'Sin ventas', icon: Trophy, note: rows[0] ? `${number.format(rows[0].cantidad)} unidades · ${number.format(rows[0].participacion)} % del total` : 'No hay productos en este periodo' },
  ] : [];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Productos más vendidos</h1><p style={{ color: 'var(--mut)' }}>Descubre qué productos eligen más tus clientes.</p></div>
      <button type="button" className="btn" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} className={result.isFetching ? 'animate-spin' : ''} />Actualizar</button>
    </header>
    <section className="glass p-4 flex flex-wrap items-center justify-between gap-3" aria-label="Periodo del ranking">
      <div className="flex flex-wrap gap-2">{[['dia', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes']].map(([value, label]) => <button type="button" key={value} className={`chip ${period === value ? 'on' : ''}`} aria-pressed={period === value}
        onClick={() => { setPeriod(value); setSearch(''); setPage(1); }}>{label}</button>)}</div>
      <p className="text-sm" style={{ color: 'var(--mut)' }}>{meta ? `${shortDate(meta.desde)} – ${shortDate(meta.hasta)}` : 'Consultando periodo'} · Hora de Colombia</p>
    </section>
    <p className="text-sm" style={{ color: 'var(--mut)' }}>Semana desde el lunes y mes desde el día 1, hasta hoy. Incluye ventas pagadas y a crédito; excluye anuladas, suspendidas, devoluciones y abonos. Variantes agrupadas por producto.</p>
    {result.isError && <div className="glass p-5" role="alert"><p>{result.error.message}</p><button type="button" className="chip mt-3" onClick={() => result.refetch()}>Reintentar</button>{resumen && <p className="text-sm mt-2">Se conservan los últimos datos disponibles.</p>}</div>}
    {result.isPending && <div className="glass p-6" role="status">Consultando productos vendidos… La primera consulta del periodo puede tardar mientras se leen las ventas del POS.</div>}
    {resumen && <>
      <div className="grid gap-4 md:grid-cols-3">{stats.map(stat => <section className="glass p-5 min-w-0" key={stat.label}>
        <div className="flex justify-between gap-2 mb-3 text-sm"><span>{stat.label}</span><stat.icon size={19} className="shrink-0" /></div>
        <p className="text-2xl font-bold break-words">{stat.value}</p><p className="text-sm mt-2" style={{ color: 'var(--mut)' }}>{stat.note}</p>
      </section>)}</div>
      {rows.length ? <ProductCharts rows={rows} total={resumen.unidades} /> : <div className="glass p-8 text-center"><Package size={32} className="mx-auto mb-3" /><h2 className="font-semibold">No hay productos vendidos en este periodo</h2><p className="text-sm mt-2">Selecciona otra opción para consultar tus ventas.</p></div>}
      {!!rows.length && <section className="glass p-4 min-w-0" aria-labelledby="product-table-title">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
          <div><h2 id="product-table-title" className="font-semibold">Ranking de productos</h2><p className="text-sm" style={{ color: 'var(--mut)' }}>Hasta los {meta.limite} más vendidos · ordenados por unidades</p></div>
          <label className="text-sm">Buscar en el ranking<div className="relative mt-1"><Search size={17} className="absolute left-3 top-3" /><input type="search" className="inp" maxLength={100} placeholder="Producto, código o categoría" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></label>
        </div>
        <div className="overflow-x-auto" role="region" aria-label="Tabla de productos más vendidos" tabIndex={0} aria-busy={result.isFetching}>
          <table className="w-full"><caption className="sr-only">Ranking por unidades vendidas</caption><thead><tr><th scope="col">Puesto</th><th scope="col">Producto</th><th scope="col">Código</th><th scope="col">Categoría</th><th scope="col" className="text-right">Unidades</th><th scope="col" className="text-right">Ventas</th><th scope="col" className="text-right">Participación</th></tr></thead>
            <tbody>{visible.map(row => <tr key={row.id}><td><span className="product-rank">{row.puesto}</span></td><td className="font-medium" style={{ whiteSpace: 'normal', minWidth: 180 }}>{row.nombre}</td><td>{row.codigo || '—'}</td><td>{row.categoria || '—'}</td><td className="text-right tabular-nums font-semibold">{number.format(row.cantidad)}</td><td className="text-right tabular-nums">{number.format(row.ventas)}</td><td className="text-right tabular-nums">{number.format(row.participacion)} %</td></tr>)}</tbody>
          </table>
        </div>
        {!filtered.length && <p className="py-6 text-center">No hay coincidencias en el ranking.</p>}
        <div className="flex flex-wrap justify-between items-center gap-3 mt-4 text-sm"><span>{filtered.length} productos · Página {currentPage} de {pages}</span><div className="flex gap-2"><button type="button" className="chip" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><button type="button" className="chip" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div></div>
      </section>}
      <p className="text-xs" role="status" style={{ color: 'var(--mut)' }}>{result.isFetching ? 'Actualizando datos…' : `Datos consultados: ${updated(meta.generado_en)} · Consulta con caché temporal, no en tiempo real.`}</p>
    </>}
  </div>;
}
