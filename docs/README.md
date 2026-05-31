# Documentación MakeLove

## Para agentes LLM

Empieza por **[../AGENTS.md](../AGENTS.md)** y luego **[ESTADO_PRODUCTO.md](ESTADO_PRODUCTO.md)**.

## Índice

| Documento | Contenido | Mantener cuando… |
|-----------|-----------|------------------|
| [ESTADO_PRODUCTO.md](ESTADO_PRODUCTO.md) | Comportamiento actual, rutas, reglas de puntos | Cambie funcionalidad o flujos |
| [CASOS_DE_USO_Y_DISEÑO.md](CASOS_DE_USO_Y_DISEÑO.md) | Diseño objetivo y decisiones de producto | Se acuerde nuevo diseño o se cierre un gap |
| [TEMA.md](TEMA.md) | Paleta y clases Tailwind `app-*` | Cambie branding/colores |
| [AVATAR_FRAMES_REFERENCE.md](AVATAR_FRAMES_REFERENCE.md) | Marcos de avatar en tienda | Nuevos assets de marcos |
| [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) | Push web (arquitectura) | Cambie flujo push |
| [PUSH_PASOS_3_4_5.md](PUSH_PASOS_3_4_5.md) | Pasos operativos push | Cambien pasos de despliegue |
| [PASO_2_SECRETS.md](PASO_2_SECRETS.md) | Secretos Supabase | Nuevos secretos |
| [../README.md](../README.md) | Setup rápido humano | Scripts, env, deploy |

## Jerarquía de verdad

1. **Código + `supabase/migrations/`** — implementación real (siempre gana).
2. **`ESTADO_PRODUCTO.md`** — descripción para humanos y agentes (mantener alineada).
3. **`CASOS_DE_USO_Y_DISEÑO.md`** — diseño acordado / histórico de decisiones.
