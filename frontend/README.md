# tiendasnumber1 · Panel administrativo

React + Vite + Tailwind 4. Datos de ejemplo en `src/data` (reemplazar por la API / props de Inertia).

    npm install
    npm run dev      # desarrollo
    npm run build    # producción (carpeta dist)

## Estructura
- `components/ui`: piezas reutilizables (Modal, Pagination, Switch, Badge, Logo)
- `components/layout`: Sidebar, Topbar, DashboardLayout, Background
- `features/*`: una carpeta por módulo (auth, dashboard, ventas, usuarios)
- `context`: estado global (sesión) · `hooks`: lógica reutilizable · `data`: mocks · `utils`: helpers
