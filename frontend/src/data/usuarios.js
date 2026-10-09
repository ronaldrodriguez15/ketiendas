const NOMBRES = ["Carolina Vélez", "Mateo Salazar", "Isabela Torres", "Felipe Navarro", "Daniela Prieto",
  "Santiago Mejía", "Juliana Cardona", "Sebastián Duarte", "Natalia Quintero", "Esteban Ríos",
  "Paula Cifuentes", "Nicolás Beltrán", "Mariana Ospina", "Tomás Arango"];
const ROLES = ["Administrador", "Vendedor", "Vendedor", "Contador", "Vendedor"];
const sinTildes = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const USUARIOS = NOMBRES.map((nombre, i) => ({
  id: i + 1,
  nombre,
  email: `${sinTildes(nombre.split(" ")[0])}@tiendasnumber1.co`,
  rol: i === 0 ? "Administrador" : ROLES[i % ROLES.length],
  activo: i % 5 !== 3,
}));
