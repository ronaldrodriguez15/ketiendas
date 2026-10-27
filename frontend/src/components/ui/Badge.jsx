import DataValue from './DataValue';

const ESTADO = {
  Administrador: { background: '#ede9fe', color: '#5b21b6' },
  Vendedor: { background: '#dcfce7', color: '#166534' },
  Contador: { background: '#dbeafe', color: '#1e40af' },
  "A crédito": { background: "#fef3c7", color: "#92400e" },
  Abono: { background: "#dbeafe", color: "#1e40af" },
  Devolución: { background: "#ffedd5", color: "#9a3412" },
  Anulada: { background: "#fee2e2", color: "#991b1b" },
  Suspendida: { background: "#ede9fe", color: "#5b21b6" },
  Pagada: { background: "#dcfce7", color: "#166534" },
  Pendiente: { background: "#fef3c7", color: "#92400e" },
  Cancelada: { background: "#fee2e2", color: "#991b1b" },
};

export default function Badge({ estado }) {
  if (estado == null || !String(estado).trim()) return <DataValue />;
  return <span className="badge" style={ESTADO[estado]}>{estado}</span>;
}
