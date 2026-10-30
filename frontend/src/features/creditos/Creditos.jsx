import CreditosAntiguos from '../ventas/CreditosAntiguos';
export default function Creditos() {
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Créditos</h1><p style={{ color: 'var(--mut)' }}>Consulta y revisa las ventas a crédito con más de 60 días.</p></div>
    <CreditosAntiguos />
  </div>;
}
