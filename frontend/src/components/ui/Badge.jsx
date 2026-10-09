const ESTADO = {
  Pagada: { background: "#dcfce7", color: "#166534" },
  Pendiente: { background: "#fef3c7", color: "#92400e" },
  Cancelada: { background: "#fee2e2", color: "#991b1b" },
};

export default function Badge({ estado }) {
  return <span className="badge" style={ESTADO[estado]}>{estado}</span>;
}
