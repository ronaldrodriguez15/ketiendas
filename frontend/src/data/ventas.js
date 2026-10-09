const CLIENTES = ["Laura Gómez", "Andrés Rojas", "María Fernanda Ruiz", "Camilo Herrera", "Valentina Cruz",
  "Julián Ortiz", "Sofía Medina", "Daniel Pardo", "Paula Jiménez", "Sebastián Lara", "Natalia Vargas", "Esteban Mora"];
const ESTADOS = ["Pagada", "Pagada", "Pendiente", "Pagada", "Cancelada", "Pagada"];

export const VENTAS = Array.from({ length: 47 }, (_, i) => ({
  id: `V-${1100 - i}`,
  fechaISO: new Date(Date.UTC(2026, 9, 9 - Math.floor(i / 3))).toISOString().slice(0, 10),
  cliente: CLIENTES[(i * 7) % CLIENTES.length],
  fecha: new Date(2026, 9, 9 - Math.floor(i / 3)).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }),
  total: Math.round((45000 + ((i * 73811) % 520000)) / 100) * 100,
  estado: ESTADOS[(i * 5) % ESTADOS.length],
}));
