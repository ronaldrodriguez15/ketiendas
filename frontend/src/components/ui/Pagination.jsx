import { ChevronLeft, ChevronRight } from "lucide-react";

const rango = (page, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (page >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", page - 1, page, page + 1, "…", total];
};

export default function Pagination({ page, totalPages, from, to, totalItems, pageSize, setPage, setPageSize, sizes = [5, 8, 10, 20] }) {
  if (!totalItems) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4" style={{ borderTop: "1px solid rgba(22,163,74,.12)" }}>
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--mut)" }}>
        <span>Mostrando {from}–{to} de {totalItems}</span>
        <select className="inp plain" style={{ width: "auto", padding: ".3rem .6rem" }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Filas por página">
          {sizes.map((n) => <option key={n} value={n}>{n} filas</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button data-liquid className="pg" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
        {rango(page, totalPages).map((n, i) =>
          n === "…" ? <span key={i} className="px-1" style={{ color: "var(--mut)" }}>…</span> : (
            <button key={i} data-liquid className={`pg ${n === page ? "on" : ""}`} onClick={() => setPage(n)} aria-current={n === page ? "page" : undefined}>{n}</button>
          )
        )}
        <button data-liquid className="pg" disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
