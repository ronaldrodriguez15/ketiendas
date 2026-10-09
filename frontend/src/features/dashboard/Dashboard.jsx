import { DollarSign, Receipt, TrendingUp, Users } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { VENTAS } from "../../data/ventas";
import { SEMANA } from "../../data/dashboard";
import { cop } from "../../utils/format";

const STATS = [
  { t: "Ventas del mes", v: cop(15750000), c: "+12,4%", i: DollarSign },
  { t: "Pedidos", v: "312", c: "+8,1%", i: Receipt },
  { t: "Ticket promedio", v: cop(50480), c: "+3,2%", i: TrendingUp },
  { t: "Usuarios activos", v: "11", c: "de 14", i: Users },
];

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Hola, {user.nombre.split(" ")[0]}</h1>
        <p style={{ color: "var(--mut)" }}>Así van las ventas de tu tienda esta semana.</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {STATS.map((s) => (
          <div key={s.t} data-liquid className="glass hov p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: "var(--mut)" }}>{s.t}</span>
              <span style={{ background: "rgba(255,255,255,.6)", border: "1px solid #fff", color: "var(--g)", padding: 8, borderRadius: 14, boxShadow: "inset 0 1px 0 #fff" }}><s.i size={18} /></span>
            </div>
            <div className="text-2xl font-bold">{s.v}</div>
            <div className="text-sm mt-1" style={{ color: "var(--g)" }}>{s.c}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div data-liquid className="glass p-5 lg:col-span-2 min-w-0">
          <div className="font-semibold mb-4">Ventas de la semana</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SEMANA}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,163,74,.15)" vertical={false} />
                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: "#5b7566", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: "#5b7566", fontSize: 12 }} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip formatter={(v) => cop(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.1)" }} />
                <Area type="monotone" dataKey="v" stroke="#16a34a" strokeWidth={3} fill="url(#gv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div data-liquid className="glass p-5 min-w-0">
          <div className="font-semibold mb-3">Últimas ventas</div>
          <div className="space-y-3">
            {VENTAS.slice(0, 6).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{v.cliente}</div>
                  <div className="text-xs" style={{ color: "var(--mut)" }}>{v.id} · {v.fecha}</div>
                </div>
                <div className="text-sm font-semibold">{cop(v.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
