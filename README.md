# MakeLove

Sistema de puntos y acciones para compartir amor. Aplicación web mobile-first.

> **Agentes / IA:** empieza por [AGENTS.md](AGENTS.md) y [docs/ESTADO_PRODUCTO.md](docs/ESTADO_PRODUCTO.md).  
> **Índice de docs:** [docs/README.md](docs/README.md).

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. En el **SQL Editor**, ejecuta las migraciones de `supabase/migrations/` **en orden numérico** (`001` … última). No basta con solo `001_initial_schema.sql`.
3. Copia la URL y la anon key desde **Settings → API**
4. Crea un archivo `.env` en la raíz:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Crear el primer admin

Tras ejecutar el schema, regístrate en la app. Luego en Supabase **Table Editor → users**, edita tu usuario y marca `is_admin = true`.

## Cómo probar en Cursor

1. Abre una terminal: `` Ctrl+` ``
2. Ejecuta: `npm run dev`
3. Abre `http://localhost:5173` en el navegador o usa **Simple Browser** de Cursor

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | Comprobación TypeScript (`tsc -b`) |
| `npm run preview` | Vista previa del build |

## Funcionalidades (resumen)

- **Auth:** Login/registro (100 pts iniciales)
- **Acciones:** Listar y crear tipos; **realizar hacia otro** (claim con confirmación de B, +1,5× para A)
- **Solicitudes:** Pedir acción a otro (12 h); B acepta → A confirma → pago (1,2× a B); rechazo/caducidad 0,2× a A
- **Dashboard:** Ranking, meta semanal, historial de saldo, preview de Historia
- **Historia:** Sagas y misiones (piedritas, recompensas)
- **Tienda:** Cosméticos (colores, badges, marcos de avatar)
- **Calendario / notificaciones / perfil** con avatar e inventario
- **Admin:** Acciones, usuarios, parejas, contenido de Historia
- **Push (opcional):** ver [docs/PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md)

Detalle y reglas: [docs/ESTADO_PRODUCTO.md](docs/ESTADO_PRODUCTO.md).

## Despliegue en Netlify

1. Conecta el repo a Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
