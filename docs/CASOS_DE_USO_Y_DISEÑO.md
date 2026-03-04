# Casos de uso y diseño – MakeLove

## Resumen de lo que pides

1. **Solicitudes (igual que ahora en concepto, ajuste de puntos)**  
   - Los usuarios dan de alta acciones y pueden **pedir** una acción a otro usuario.  
   - La solicitud **caduca a las 12 horas**.  
   - **Si B acepta:** B gana **1,2 × valor** de la acción, A (quien pidió) **pierde** el valor de la acción.  
   - **Si B rechaza o caduca:** A gana **0,2 × valor** y recibe notificación de que se canceló/caducó y que ha ganado esos puntos.

2. **Nuevo flujo: “Acción realizada hacia otro”**  
   - Desde el **detalle de una acción**, el usuario A puede pulsar algo tipo **“Acción realizada”**.  
   - Ve un **formulario para indicar hacia qué usuario** la ha realizado (ej. selecciona usuario B).  
   - Al confirmar, **B recibe una notificación**: “El usuario A dice que ha realizado la acción X hacia ti”.  
   - **Si B cancela:** se notifica a A que se ha cancelado.  
   - **Si B confirma:** A recibe notificación de que ha sido confirmada y **A gana 1,5 × valor** de la acción.

3. **Vista de inicio (Dashboard)**  
   - Debajo de las solicitudes pendientes: **historial de saldo**.  
   - Orden: primera entrada = más reciente, última = más antigua.  
   - Cada entrada: **saldo inicial**, **evento** que añade/resta puntos, **puntos que han variado**, **saldo final**.

---

## Estado actual (resumen)

| Aspecto | Ahora |
|--------|--------|
| Solicitudes | A pide a B. 12 h. `points_cost` = valor acción, `reward_amount` = % (ej. 20 %) del coste. Al aceptar: A pierde `points_cost`, B gana `reward_amount`. Al rechazar: A gana `reward_amount` (el mismo %). |
| “Marcar realizada” | Solo **para uno mismo**: quien marca gana el valor de la acción (sin elegir “hacia quién”). |
| Dashboard | Saldo, aviso de solicitudes pendientes, lista de acciones. **No** hay historial de saldo. |
| Notificaciones | Tipo `action_request` con enlace a solicitudes. No hay tipos para “realizada hacia ti” / confirmada / cancelada / rechazo-caducado. |

---

## Diseño objetivo

### A. Solicitudes (flujo existente, nuevas reglas de puntos)

- **Crear solicitud:** igual: A elige acción y usuario B, cadencia 12 h.  
  - En BD: `points_cost = points_value`, `reward_amount = 1.2 * points_value` (lo que gana B si acepta).  
- **Aceptar (B):**  
  - A pierde `points_value`.  
  - B gana `1.2 * points_value`.  
- **Rechazar o caducar:**  
  - A gana `0.2 * points_value`.  
  - Notificación a A: “La solicitud se ha cancelado/caducado. Has ganado X puntos.”  

*(Opcional: dejar de usar `reward_percentage` en este flujo y usar siempre 1.2 y 0.2; o seguir guardando un porcentaje pero interpretarlo como “120 % para B” y “20 % de devolución para A”.)*

### B. Nuevo flujo: “Acción realizada hacia otro” (claim / confirmación)

- **Entidad nueva:** p. ej. `action_claims` (o `performed_for_requests`).  
  - Campos: `claimer_id` (A), `target_user_id` (B), `action_type_id`, `status` (pending / confirmed / cancelled), `created_at`, `responded_at`.  
- **Flujo:**  
  1. A, en detalle de la acción X, pulsa “Acción realizada”.  
  2. Formulario: seleccionar usuario B (y opcionalmente notas).  
  3. Al confirmar: se crea un “claim” pendiente y se notifica a B.  
  4. B ve notificación: “A dice que ha realizado la acción X hacia ti.”  
  5. B puede **cancelar** → notificación a A: “Se ha cancelado.” (sin cambios de puntos.)  
  6. B puede **confirmar** → A recibe notificación “Confirmada” y **A gana 1,5 × valor** de la acción.  

No hace falta que B “pierda” puntos en este flujo; solo A gana cuando B confirma.

**Decisión:** Solo existe este flujo (“acción realizada hacia otro”). Se elimina la opción de “marcar realizada para mí” (auto-asignarse puntos sin que otro confirme). En el detalle de la acción solo habrá el botón/flujo de “Acción realizada” eligiendo hacia qué usuario.

### C. Historial de saldo (Dashboard)

- **Tabla nueva:** p. ej. `balance_transactions` (o `points_movements`).  
  - Campos: `user_id`, `balance_before`, `delta` (+ o -), `balance_after`, `event_type` (ej. `request_accepted`, `request_rejected`, `request_expired`, `performed_for_confirmed`, etc.), `reference_id` (opcional, id de request/claim), `description` (texto corto para UI), `created_at`.  
- Cada vez que un RPC modifique el saldo de un usuario (aceptar/rechazar/caducar solicitud, confirmar “realizada hacia”), se insertan las filas correspondientes en esta tabla.  
- En el Dashboard: debajo de solicitudes pendientes, lista de movimientos del usuario actual ordenados por `created_at` descendente (más reciente primero), mostrando: saldo inicial, evento, variación, saldo final.

### D. Notificaciones

- Mantener: `action_request` (nueva solicitud para B).  
- Añadir (o reutilizar `type` + `reference_id`):  
  - “A dice que ha realizado la acción X hacia ti” → para B (claim pendiente).  
  - “B ha confirmado que realizaste la acción X hacia él/ella” → para A.  
  - “B ha cancelado tu realización de la acción X hacia él/ella” → para A.  
  - “La solicitud [de acción X] se ha cancelado/caducado. Has ganado X puntos.” → para A.  

---

## Resumen de cambios técnicos

1. **BD**  
   - Ajustar `create_action_request` / `accept_request` / `reject_request` y la lógica de caducidad para usar 1.2 y 0.2 y, si aplica, rellenar `balance_transactions`.  
   - Nueva tabla `action_claims` y RPCs: crear claim, confirmar claim, cancelar claim (con notificaciones y, en confirmación, sumar 1.5× a A y escribir en `balance_transactions`).  
   - Nueva tabla `balance_transactions` y que todos los RPCs que cambien saldo inserten ahí.  

2. **Front**  
   - **ActionDetail:** sustituir “Marcar realizada” por el flujo “Acción realizada” → selector de usuario (B) → enviar claim. No se mantiene la opción de marcar realizada solo para uno mismo.  
   - **Dashboard:** sección “Historial de saldo” con lista de `balance_transactions` (saldo inicial, evento, variación, saldo final), orden más reciente primero.  
   - **Notifications:** mostrar mensajes para los nuevos tipos (claim pendiente para B, confirmada/cancelada para A, rechazo/caducado con puntos para A).  
   - **Requests:** textos/UX para dejar claro coste (A pierde valor) y recompensa (B gana 1.2×; A gana 0.2× si rechazo/caducado).  

Si este diseño coincide con lo que quieres, el siguiente paso es bajar a detalle de nombres de tablas/campos y de RPCs concretos (parámetros y orden de operaciones) y luego implementar migraciones y front.
