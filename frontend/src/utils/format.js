export const cop = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const iniciales = (nombre = "") =>
  nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
