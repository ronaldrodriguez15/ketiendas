import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import Badge from "../../components/ui/Badge";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { VENTAS } from "../../data/ventas";
import { cop } from "../../utils/format";

const FILTROS = ["Todas", "Pagada", "Pendiente", "Cancelada"];

export default function Ventas() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("Todas");

  const filtradas = useMemo(
    () => VENTAS.filter((v) => (filtro === "Todas" || v.estado === filtro) && (v.cliente + v.id).toLowerCase().includes(q.toLowerCase())),
    [q, filtro]
  );
  const cobrado = filtradas.filter((v) => v.estado === "Pagada").reduce((a, v) => a + v.total, 0);
  const pg = usePagination(filtradas, 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p style={{ color: "var(--mut)" }}>Cobrado en esta vista: <b style={{ color: "var(--g)" }}>{cop(cobrado)}</b></p>
        </div>
        <button data-liquid className="btn"><Plus size={18} /> Nueva venta</button>
      </div>

      <div data-liquid className="glass p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative" style={{ flex: "1 1 220px" }}>
            <Search size={18} className="absolute" style={{ left: 12, top: 13, color: "var(--mut)" }} />
            <input className="inp" placeholder="Buscar por cliente o código" value={q} onChange={(e) => { setQ(e.target.value); pg.setPage(1); }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map((e) => (
              <button key={e} data-liquid className={`chip ${filtro === e ? "on" : ""}`} onClick={() => { setFiltro(e); pg.setPage(1); }}>{e}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr><th>Código</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {pg.items.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">{v.id}</td><td>{v.cliente}</td><td>{v.fecha}</td>
                  <td className="font-semibold">{cop(v.total)}</td><td><Badge estado={v.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtradas.length && <div className="text-center py-10" style={{ color: "var(--mut)" }}>No hay ventas con ese filtro. Prueba con otra búsqueda.</div>}
        </div>

        <Pagination {...pg} />
      </div>
    </div>
  );
}
