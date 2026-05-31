# Guía para agentes — MakeLove

Documento de entrada para LLMs (Cursor, etc.).

## Fuente de verdad

**El código y las migraciones SQL mandan sobre la documentación.** Los `.md` describen el producto para orientar; si hay contradicción, confía en `src/`, `supabase/migrations/` y RPCs, y luego actualiza los docs en la misma sesión.

## Lectura obligatoria (orden)

1. **[docs/ESTADO_PRODUCTO.md](docs/ESTADO_PRODUCTO.md)** — Qué hace el producto hoy, reglas de negocio y rutas.
2. **[docs/README.md](docs/README.md)** — Índice del resto de documentación.
3. Si tocas BD o RPCs: `supabase/migrations/` (orden numérico).
4. Si tocas UI/tema: [docs/TEMA.md](docs/TEMA.md).

## Stack y comandos

| Pieza | Tecnología |
|-------|------------|
| Front | React 18, TypeScript, Vite, Tailwind, TanStack Query, React Router |
| Back | Supabase (Auth, PostgreSQL, RLS, RPC `SECURITY DEFINER`) |
| Deploy | Netlify (`netlify.toml`, publish `dist`) |

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
npm run typecheck
npm run lint
```

Variables: ver `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; push opcional con `VITE_VAPID_PUBLIC_KEY`).

## Estructura del código

```
src/
  pages/           # Pantallas (Dashboard, Actions, Historia, Tienda, admin/*)
  components/      # UI por dominio (dashboard, historia, shop, profile, layout)
  hooks/           # Datos Supabase (useRequests, useClaims, useHistoria, useShop…)
  lib/             # Utilidades (supabase, levels, experienceHistory)
  types/           # index.ts (app) + database.ts (generado/manual Supabase)
supabase/migrations/   # Esquema y lógica de negocio (RPCs)
docs/                  # Producto, diseño, ops
```

Alias de imports: `@/` → `src/`.

## Reglas de negocio (resumen)

- **Puntos:** saldo en `users.points_balance`; historial en `balance_transactions`.
- **Experiencia / nivel:** `lifetime_points_earned`; fórmula en `src/lib/levels.ts` (debe coincidir con `_level_from_lifetime_points` en SQL).
- **Solicitudes (A → B):** caducan 12 h. B acepta → `accepted_pending`; **A confirma** → A pierde `points_cost`, B gana `reward_amount` (1,2× valor). Rechazo/caducidad → A gana 0,2×. Ver migración `030_request_confirm_before_payment.sql`.
- **Claims (“acción realizada hacia otro”):** solo desde detalle de acción; B confirma → A gana 1,5×. No existe “marcar para mí mismo”.
- **Acciones:** cualquier usuario autenticado puede **crear** tipos (`005_action_types_any_user_insert`); admin edita/elimina.
- **Historia / tienda / parejas:** ver `docs/ESTADO_PRODUCTO.md`.

## Convenciones al cambiar código

- Lógica que mueve puntos o saldo → **RPC en Supabase** + filas en `balance_transactions`, no solo en el cliente.
- Reutilizar hooks existentes; patrones REST directos en `getRestHeaders()` donde ya se usa.
- Textos de UI en español.
- Tema: clases `app-*` (no reintroducir paleta rosa del doc histórico).

## Mantenimiento de documentación (cada sesión)

Al terminar un cambio funcional o de arquitectura, actualiza en la misma PR/sesión:

| Cambio | Actualizar |
|--------|------------|
| Comportamiento de producto | `docs/ESTADO_PRODUCTO.md` |
| Diseño acordado / pendiente | `docs/CASOS_DE_USO_Y_DISEÑO.md` o nuevo doc en `docs/` |
| Setup / scripts / deploy | `README.md` |
| Tema / colores | `docs/TEMA.md` |
| Guía agentes | Este archivo solo si cambia el flujo de lectura o comandos |

No dejes `README.md` contradiciendo `ESTADO_PRODUCTO.md`.

## Despliegue (Supabase + Git + Netlify)

Cuando el cambio incluya **nueva migración SQL** o RPCs que deban existir en producción:

1. **Dejar la migración en el repo** (`supabase/migrations/NNN_*.sql`).
2. **Pedir confirmación al usuario** antes de asumir que Supabase remoto está actualizado. Mensaje tipo: «Ejecuta en Supabase SQL Editor la migración `NNN_nombre.sql` (o `supabase db push`). Avísame cuando esté aplicada.»
3. **Solo después de su confirmación** (o si confirma que ya la aplicó): proponer commits ordenados y, si pide despliegue, `git push` a `main` para que Netlify reconstruya.
4. **Commits sugeridos** (en este orden cuando aplique): `docs:` → `feat(db):` / `fix:` en front → cambios UI aislados. No mezclar migración con refactors no relacionados.
5. **No hacer `git push`** sin que el usuario lo pida o confirme explícitamente.

Netlify: build `npm run build`, directorio `dist`; variables `VITE_SUPABASE_*` en el panel.

## Qué no hacer

- Ejecutar solo `001_initial_schema.sql` en proyectos nuevos: aplicar **todas** las migraciones en orden.
- Buscar `reward_percentage` en el código (eliminado en migración `041`).
