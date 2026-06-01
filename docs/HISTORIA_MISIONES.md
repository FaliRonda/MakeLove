# Historia — misiones y diseño de objetivos

**Última revisión:** 2026-06-01 (catálogo `action_types` prod).  
Fuente en código: `supabase/migrations/027_seed_el_despertar.sql`, `037_seed_roma_cuatro_atardeceres.sql`, lógica en `_mission_progress_as_of` (p. ej. `036_roma_meta_missions_shop_frame.sql`).

## Decisiones de producto (cerradas)

| Tema | Decisión |
|------|----------|
| Acciones concretas en misiones | Las misiones ya tienen `id` (UUID). Las **futuras** temáticas enlazarán un `action_type_id` documentado aquí al crearlas. Las actuales siguen **genéricas** (sin filtro por acción). |
| “Haz esta acción” | Solo cuenta el flujo **claim** confirmado (`actions_done` = `action_records` sin `request_id`). Las solicitudes confirmadas **no** cuentan. |
| Pareja + acción concreta | **No** se diseñará: misiones con `action_type_id` serán siempre `target_type = individual`. |
| Creación de acciones | Sin cambio: cualquier usuario puede crear `action_types` (nombre + puntos). |
| Misiones ya publicadas | **No se modifican.** El Despertar y Roma siguen genéricas; las sagas nuevas podrán usar acciones concretas. |

## Cómo documentar IDs en producción

Los UUID de misiones **cambian** si se vuelve a ejecutar un seed idempotente (Roma borra y reinserta por nombre). Para mapeo estable usad:

1. **Clave humana:** `historia` + `capítulo (orden)` + `misión (orden)` + título.
2. **UUID en remoto:** tras aplicar seeds, en Supabase SQL Editor:

```sql
SELECT s.name AS historia, c.order_number AS cap, c.name AS capitulo,
       m.order_number AS mision_ord, m.id AS mission_id, m.title,
       mr.metric_type, mr.required_amount, mr.prior_mission_ids,
       m.target_type, m.reward_piedritas, si.name AS recompensa_item
FROM missions m
JOIN chapters c ON c.id = m.chapter_id
JOIN stories s ON s.id = c.story_id
LEFT JOIN mission_requirements mr ON mr.mission_id = m.id
LEFT JOIN shop_items si ON si.id = m.reward_shop_item_id
ORDER BY s.name, c.order_number, m.order_number;
```

Para **acciones temáticas futuras**, añadir columna/fila con `action_type_id` y consulta:

```sql
SELECT id, name, points_value, is_active, created_at
FROM action_types
ORDER BY name;
```

Actualizar «Misiones temáticas en prod» al crear sagas nuevas (abajo).

---

## `action_types` en producción (MakeLove prod)

Referencia para diseñar sagas futuras. Si alguien crea una acción nueva, añadir fila aquí.

| `action_type_id` | Nombre | Puntos |
|------------------|--------|--------|
| `056ca3d1-9555-4eb8-973e-a233129b399f` | Mimitos 5' 😊 | 5 |
| `52d8527a-c2f2-4b5a-b0c1-c1e3966e675c` | Masaje 20'/30' 🔹 | 30 |
| `6c6bace9-4a71-4dea-9783-bd88ef7ccd96` | Metralleta ⚡ | 10 |
| `72487d67-ca69-48bd-b442-5ea934736678` | Mamaso 😜 | 20 |
| `7a778862-fa53-4b8c-ba23-91b477c90d6e` | Rasca y gana 🪙 | 20 |
| `b27c6300-213c-485f-b34b-292e7787e050` | Polvillo ❤️‍🔥 | 10 |
| `b80953bf-d937-476e-bac7-78cd183d842e` | Hacer un regalo 🎁 | 10 |
| `d2fd8039-67e9-40ab-9e54-74a290e42c4b` | Cita 😳 | 7 |
| `f5f07a7c-37f4-4f83-a9c2-d69cc0a2d520` | Serso furtivo 💨 | 25 |

---

## Inventario (contenido seed en repo)

Ninguna misión seed usa filtro por `action_type_id` (todas genéricas). **No hay que tocar esas filas.** Desde migración `042` las misiones nuevas pueden enlazar una acción en admin (`/admin/historia`).

### El Despertar

| Cap. | Ord. | Título | `target_type` | Métrica | Cant. | Piedritas |
|------|------|--------|---------------|---------|-------|-----------|
| 1 | 1 | El Primer Gesto | individual | `actions_done` | 1 | 20 |
| 1 | 2 | La Primera Solicitud | individual | `requests_sent_confirmed` | 1 | 10 |
| 1 | 3 | El Primer Sí | individual | `requests_received_confirmed` | 1 | 15 |

- **Historia:** El Despertar · capítulo «Acto I: La Chispa» · `2026-03-26` … `2026-03-31` · seed `027`.
- **Tienda ligada:** insignia «Insignia de Marzo · La Chispa» (misma migración, no atada a una misión concreta).

### Cuatro atardeceres en Roma

| Día (cap.) | Ord. | Título | `target_type` | Métrica | Cant. | Notas | Piedritas |
|------------|------|--------|---------------|---------|-------|-------|-----------|
| 1 | 1 | Llegamos, existimos | couple | `actions_done` | 2 | | 25 |
| 1 | 2 | La primera “pregunta romana” | couple | `requests_sent_confirmed` | 1 | | 20 |
| 2 | 1 | Historia compartida | couple | `actions_done` | 2 | | 30 |
| 2 | 2 | El sí del otro | couple | `requests_received_confirmed` | 2 | | 25 |
| 3 | 1 | Turista con piernas | couple | `actions_done` | 2 | | 35 |
| 3 | 2 | Cuando el caos aprieta, se pide | couple | `requests_sent_confirmed` | 2 | | 35 |
| 4 | 1 | Decimos sí con hechos | couple | `requests_received_confirmed` | 2 | | 30 |
| 4 | 2 | Preludio de cierre | couple | `prior_missions_complete` | 4 de 6 | pool: m11,m12,m21,m22,m31,m32 | 40 |
| 4 | 3 | Roma cerrada | couple | `prior_missions_complete` | 7 de 7 | pool: m11…m41; recompensa marco tienda | 0 + marco |

- **Historia:** Cuatro atardeceres en Roma · 4 capítulos (un día cada uno) · `2026-04-05` … `2026-04-08` · seed `037` (idempotente por nombre de historia).
- **Recompensa final:** ítem tienda «Marco · Máscara veneciana» (`reward_shop_item_id` en misión Roma cerrada).

---

## Métricas disponibles (referencia)

| `metric_type` | Cuenta |
|---------------|--------|
| `actions_done` | Claims confirmados (registros sin `request_id`), en ventana del capítulo |
| `requests_sent_confirmed` | Solicitudes enviadas y confirmadas por A (`confirmed_at`) |
| `requests_received_confirmed` | Solicitudes recibidas y confirmadas |
| `points_gained` | Suma de puntos ganados en el capítulo |
| `levels_gained` | Niveles subidos en el capítulo |
| `prior_missions_complete` | N de M misiones previas completas (`prior_mission_ids`) |

Ventana temporal: fechas del **capítulo** (zona Madrid), no un deadline independiente.

---

## Implementado (migración `042`)

- Columna `mission_requirements.action_type_id` (nullable).
- Progreso y `get_active_story_state` filtran por acción cuando aplica.
- Admin: selector «Acción concreta» en misiones **individual** con métrica de acción/solicitud.
- UI Historia: texto con nombre de la acción.

**Despliegue:** ejecutar `042_mission_requirements_action_type.sql` en Supabase prod antes de crear sagas temáticas.

---

## Misiones temáticas en prod (sagas futuras)

Solo para misiones **nuevas** que exijan una acción concreta. Ejemplo de fila:

| Historia · cap · ord | `mission_id` | `action_type_id` | Métrica | Cant. |
|----------------------|--------------|------------------|---------|-------|
| *(vacío hasta crear saga)* | | | | |

Consulta misiones existentes (UUID por entorno):

```sql
-- ver bloque SQL en sección «Cómo documentar IDs en producción»
```
