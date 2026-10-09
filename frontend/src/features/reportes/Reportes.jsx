import { useMemo, useState } from "react";
import { Download, Receipt, Wallet, Clock, TrendingUp } from "lucide-react";
import { VENTAS } from "../../data/ventas";
import { cop } from "../../utils/format";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { generarReporte, reporteCSV } from "./reportData";

const ESTADOS = ["Todas", "Pagada", "Pendiente", "Cancelada"];
const fechaVisible = (fecha) => fecha.split("-").reverse().join("/");

export default function Reportes() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState("Todas");
  const invalido = Boolean(desde && hasta && desde > hasta);
  const { filtradas, resumen, dias } = useMemo(() => generarReporte(VENTAS, { desde, hasta, estado }), [desde, hasta, estado]);
  const pg = usePagination(dias, 8);
  const cambiar = (setter) => (event) => { setter(event.target.value); pg.setPage(1); };
  const limpiar = () => { setDesde(""); setHasta(""); setEstado("Todas"); pg.setPage(1); };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([reporteCSV(filtradas)], { type: "text/csv;charset=utf-8;" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `ke-tiendas-reporte-${desde || "inicio"}-${hasta || "fin"}.csv`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const tarjetas = [
    { titulo: "Ventas registradas", valor: resumen.cantidad, icono: Receipt, detalle: "En el rango seleccionado" },
    { titulo: "Total cobrado", valor: cop(resumen.cobrado), icono: Wallet, detalle: `${resumen.pagadas} ventas pagadas` },
    { titulo: "Por cobrar", valor: cop(resumen.pendiente), icono: Clock, detalle: "Ventas pendientes de pago" },
    { titulo: "Ticket promedio", valor: cop(resumen.ticket), icono: TrendingUp, detalle: "Calculado sobre ventas pagadas" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p style={{ color: "var(--mut)" }}>Consulta el resumen de ventas de Ké Tiendas.</p>
          <p className="text-xs mt-1" style={{ color: "var(--mut)" }}>Datos de demostración, compartidos con el módulo Ventas.</p>
        </div>
        <button type="button" data-liquid className="btn" disabled={invalido || !filtradas.length} onClick={descargar}>
          <Download size={18} /> Exportar CSV
        </button>
      </div>

      <section data-liquid className="glass p-4" aria-label="Filtros del reporte">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 items-end">
          <label className="text-sm font-medium">Desde
            <input className="inp plain mt-1" type="date" value={desde} max={hasta || undefined} onChange={cambiar(setDesde)} aria-invalid={invalido} aria-describedby={invalido ? "error-fechas" : undefined} />
          </label>
          <label className="text-sm font-medium">Hasta
            <input className="inp plain mt-1" type="date" value={hasta} min={desde || undefined} onChange={cambiar(setHasta)} aria-invalid={invalido} aria-describedby={invalido ? "error-fechas" : undefined} />
          </label>
          <label className="text-sm font-medium">Estado
            <select className="inp plain mt-1" value={estado} onChange={cambiar(setEstado)}>
              {ESTADOS.map((valor) => <option key={valor}>{valor}</option>)}
            </select>
          </label>
          <button type="button" data-liquid className="chip" onClick={limpiar}>Limpiar filtros</button>
        </div>
        {invalido && <p id="error-fechas" role="alert" className="text-sm mt-3" style={{ color: "#991b1b" }}>La fecha inicial debe ser anterior o igual a la fecha final.</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map(({ titulo, valor, icono: Icono, detalle }) => (
          <section key={titulo} data-liquid className="glass p-5" aria-label={titulo}>
            <div className="flex items-center justify-between gap-2 text-sm" style={{ color: "var(--mut)" }}>{titulo}<Icono size={20} /></div>
            <div className="text-2xl font-bold mt-3">{invalido ? "—" : valor}</div>
            <p className="text-xs mt-2" style={{ color: "var(--mut)" }}>{detalle}</p>
          </section>
        ))}
      </div>

      <section data-liquid className="glass p-4" aria-labelledby="resumen-diario">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 id="resumen-diario" className="font-semibold">Resumen por día</h2>
          <p className="text-sm" style={{ color: "var(--mut)" }}>Canceladas: {cop(resumen.cancelado)} · No incluidas en lo cobrado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <caption className="sr-only">Ventas agrupadas por fecha y estado de pago</caption>
            <thead><tr><th scope="col">Fecha</th><th scope="col">Ventas</th><th scope="col">Cobrado</th><th scope="col">Pendiente</th><th scope="col">Cancelado</th></tr></thead>
            <tbody>{pg.items.map((dia) => (
              <tr key={dia.fecha}><td>{fechaVisible(dia.fecha)}</td><td>{dia.cantidad}</td><td className="font-semibold">{cop(dia.cobrado)}</td><td>{cop(dia.pendiente)}</td><td>{cop(dia.cancelado)}</td></tr>
            ))}</tbody>
          </table>
          {!dias.length && <p className="text-center py-10" role="status" style={{ color: "var(--mut)" }}>{invalido ? "Corrige el rango de fechas para consultar el reporte." : "No hay ventas para los filtros seleccionados."}</p>}
        </div>
        <Pagination {...pg} />
      </section>
    </div>
  );
}
