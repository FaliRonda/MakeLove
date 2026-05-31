# Estado actual del producto — MakeLove

**Documentación orientativa** (actualizar en cada cambio de comportamiento). Si contradice el código o las migraciones SQL, **manda el código**.  
Última revisión: 2026-05-31.

## Qué es

App web **mobile-first** para una pareja/grupo cercano: registrar “acciones de amor”, **puntos**, solicitudes entre usuarios, historia gamificada (sagas/misiones), tienda cosmética y ranking.

## Módulos y rutas

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/` | Dashboard | Ranking, preview Historia, meta semanal, solicitudes pendientes, historial de saldo |
| `/actions` | Acciones | Lista; **crear** acción (nombre + puntos) |
| `/actions/:id` | Detalle | Flujo **claim** hacia otro usuario (no auto-marcar) |
| `/actions/:id/history` | Historial acción | Registros de la acción |
| `/requests` | Solicitudes | Crear, aceptar, rechazar, confirmar cumplimiento, revertir |
| `/calendar` | Calendario | Historial temporal con filtros |
| `/notifications` | Notificaciones | Tipos varios (`action_request`, claims, solicitudes…) |
| `/historia` | Historia | Saga activa, misiones, recompensas (piedritas / ítems) |
| `/tienda` | Tienda | Comprar/equipar cosméticos (colores nombre, badges, marcos…) |
| `/profile`, `/profile/:userId` | Perfil | Avatar, inventario, nivel/medallas |
| `/admin/*` | Admin | Acciones, usuarios, **parejas**, **historia** |

Navegación inferior: Inicio, Acciones, Solicitudes, Historia, Tienda.

## Economía

### Puntos (`points_balance`)

| Evento | Efecto |
|--------|--------|
| Registro | +100 iniciales (y base de `lifetime_points_earned`) |
| Solicitud: B acepta y **A confirma** cumplimiento | A −`points_cost`; B +`reward_amount` (= 1,2 × valor acción) |
| Solicitud: rechazo o caducidad | A +0,2 × valor |
| Claim: B **confirma** | A +1,5 × valor |
| Claim: B cancela | Sin movimiento |
| Tienda / recompensas historia | Según RPC/item (ver migraciones `026+`) |
| Meta colaboración semanal | Bonus al reclamar (`022_weekly_collab_goal`) |

Recompensas de solicitudes: **fijas** 1,2× (B al confirmar A) y 0,2× (A si rechazo/caducidad), definidas en RPCs desde migración `006`. El antiguo `reward_percentage` se eliminó en `041`.

### Solicitudes — flujo en dos pasos (desde `030`)

1. A crea solicitud → B notificado (`pending`, expira 12 h).
2. B **acepta** → `accepted_pending` (aún **sin** mover puntos).
3. A **confirma** realización (`confirm_request_completion`) → se cobra/paga y se crean `action_records` + `balance_transactions`.
4. Rechazo, cancelación, caducidad y revertir tienen RPCs propios (`reject_request`, `cancel_request`, `expire_pending_requests`, `revert_request`…).

### Claims (`action_claims`)

1. A en detalle de acción elige usuario B → claim `pending`.
2. B confirma o cancela (`confirm_claim` / `cancel_claim`).
3. Confirmación: puntos a A, notificaciones, `action_records` vinculados.

### Experiencia y nivel

- `lifetime_points_earned`: puntos ganados de por vida.
- Nivel: `1 + floor((lifetime - 1) / 100)` — `src/lib/levels.ts` y SQL `_level_from_lifetime_points`.
- Medallas por nivel: `user_level_medals` (`020`).

### Piedritas

Moneda secundaria para Historia/tienda (`piedritas_balance`, migración `023+`).

## Historia (“Historias de amor”)

- Sagas, capítulos, misiones con requisitos (acciones hechas, claims confirmados, fechas…).
- Estado activo vía RPCs (`get_active_story_state`, etc.).
- Admin: `/admin/historia`.
- Contenido seed en migraciones (`027`, `037`, `038`…).

## Tienda e inventario

- Tipos: `name_color`, `badge`, `medal`, `avatar_frame`.
- Compra con puntos/piedritas; equipar en perfil.
- Referencia marcos: [AVATAR_FRAMES_REFERENCE.md](AVATAR_FRAMES_REFERENCE.md).

## Parejas (`couples`)

- Usuarios agrupados en parejas para permisos/historia (RLS en registros de acciones, etc.).
- Gestión admin: `/admin/couples`.

## Notificaciones y push

- Tabla `notifications` + tipos según flujo.
- Push web: [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md), función `supabase/functions/send-push`.

## Admin vs usuario

| Capacidad | Quién |
|-----------|--------|
| Crear tipo de acción | **Cualquier usuario autenticado** (decisión de producto; ver `Actions.tsx` + migración `005`) |
| Editar/eliminar tipos de acción | Admin |
| CRUD usuarios, parejas, historia | Admin |
| Resto de la app | Usuarios autenticados |

## Branding / UI

- Tema actual: oscuro “PingusLove” (violeta + acento cian) — [TEMA.md](TEMA.md).

## Base de datos

- Proyecto Supabase: aplicar migraciones `001` … `041` en orden.
- Lógica crítica en funciones PL/pgSQL (`SECURITY DEFINER`).
- Tipos TS: `src/types/database.ts` (mantener alineado con columnas nuevas).

## Despliegue

- Netlify: build `npm run build`, publish `dist`.
- Env en Netlify: mismas variables que `.env.example`.

## Documentos relacionados

| Doc | Uso |
|-----|-----|
| [CASOS_DE_USO_Y_DISEÑO.md](CASOS_DE_USO_Y_DISEÑO.md) | Diseño objetivo 2025 (mayoría **implementada**; ver cabecera del archivo) |
| [PUSH_*.md](PUSH_NOTIFICATIONS.md) | Operativa push |
| [PASO_2_SECRETS.md](PASO_2_SECRETS.md) | Secretos Supabase |

## Pendientes / deuda conocida

- [ ] Email al recibir solicitud (roadmap, no implementado).
- [ ] Tests automatizados (solo `npm run typecheck` por ahora).
