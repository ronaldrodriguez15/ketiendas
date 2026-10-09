import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Background from "../../components/layout/Background";
import Logo from "../../components/ui/Logo";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@tiendasnumber1.co");
  const [pass, setPass] = useState("12345678");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const enviar = (e) => {
    e.preventDefault();
    setCargando(true);
    setTimeout(() => { login(email); navigate("/dashboard"); }, 900);
  };

  return (
    <Background>
      <div className="rise min-h-screen flex items-center justify-center p-4">
        <form onSubmit={enviar} data-liquid className="glass w-full" style={{ maxWidth: 420, padding: "2.2rem" }}>
          <div className="mb-6"><Logo centered /></div>
          <h1 className="text-2xl font-bold mb-1">Inicia sesión</h1>
          <p className="text-sm mb-5" style={{ color: "var(--mut)" }}>Ingresa con tu cuenta para gestionar la tienda.</p>
          <div className="space-y-3">
            <div className="relative">
              <Mail size={18} className="absolute" style={{ left: 12, top: 13, color: "var(--mut)" }} />
              <input className="inp" type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute" style={{ left: 12, top: 13, color: "var(--mut)" }} />
              <input className="inp" type={ver ? "text" : "password"} placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} required />
              <button type="button" onClick={() => setVer(!ver)} className="absolute" style={{ right: 12, top: 12, color: "var(--mut)" }} aria-label="Mostrar contraseña">
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" data-liquid className="btn w-full mt-5" disabled={cargando}>{cargando ? "Entrando..." : "Ingresar"}</button>
        </form>
      </div>
    </Background>
  );
}
