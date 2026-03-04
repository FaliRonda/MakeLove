# MakeLove

Sistema de puntos y acciones para compartir amor. Aplicación web mobile-first.

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. En el **SQL Editor**, ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`
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
| `npm run preview` | Vista previa del build |

## Funcionalidades

- **Auth:** Login/registro (100 pts iniciales)
- **Acciones:** Marcar realizadas, ganar puntos
- **Solicitudes:** Pedir a otro usuario que haga una acción (caducan en 12h)
- **Recompensas:** % configurable; compensación si rechaza
- **Calendario:** Historial con filtros
- **Notificaciones:** Badge y listado
- **Admin:** CRUD acciones y gestión de usuarios

## Despliegue en Netlify

1. Conecta el repo a Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
