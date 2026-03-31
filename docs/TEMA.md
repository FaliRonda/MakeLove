# Tema de colores – MakeLove

Todo el tema visual de la app se controla desde **un solo sitio**: `tailwind.config.js` → `theme.extend.colors.app`.

La app usa un **tema oscuro** alineado con la marca PingusLove: fondo violeta muy oscuro, superficies lilas, acento **cian hielo** (como el pingüino del logo) y tipografía **Plus Jakarta Sans**.

## Dónde cambiar el tema

1. **`tailwind.config.js`**  
   Edita el objeto `app` dentro de `theme.extend.colors`. Ahí se definen los colores del tema.

2. **`index.html`** (opcional)  
   La etiqueta `<meta name="theme-color" content="...">` define el color de la barra del navegador en móvil. Puedes poner el mismo valor que `app.accent` (por ejemplo `#0d9488`).

## Colores del tema (`app`)

| Clave            | Uso típico                          | Ejemplo de clase Tailwind   |
|------------------|-------------------------------------|-----------------------------|
| `bg`             | Fondo de página (más oscuro)         | `bg-app-bg`                 |
| `surface`        | Tarjetas, paneles, inputs           | `bg-app-surface`            |
| `surface-alt`    | Fondos elevados (tabs, badges)     | `bg-app-surface-alt`       |
| `border`         | Bordes suaves                       | `border-app-border`         |
| `border-hover`   | Bordes al hacer hover               | `border-app-border-hover`   |
| `accent`         | Botones principales, enlaces        | `bg-app-accent`, `text-app-accent` |
| `accent-hover`   | Hover de botones/enlaces            | `hover:bg-app-accent-hover` |
| `muted`          | Texto secundario                    | `text-app-muted`            |
| `foreground`     | Títulos y texto principal           | `text-app-foreground`       |
| `foreground-dark`| Texto más fuerte / body             | `text-app-foreground-dark`  |

## Cómo cambiar a otro tema

1. Abre `tailwind.config.js`.
2. Sustituye los valores hex del objeto `app` por los de tu paleta (por ejemplo otro morado/turquesa o azul/verde).
3. Actualiza `theme-color` en `index.html` y `manifest.json` con el mismo `app.bg` (barra del sistema / splash PWA).
4. Guarda: no hace falta tocar ningún `.tsx`; las clases ya usan `app-*`.

## Colores que no son del tema

Se siguen usando colores semánticos de Tailwind para estados:

- **Errores / rechazar:** `red-500`, `red-600`, `red-100`, etc.
- **Éxito / aceptado:** `green-100`, `green-800`, `green-600`.
- **Avisos / pendiente:** `amber-100`, `amber-800`, `amber-600`.

Si quisieras que también dependan del tema, se podrían añadir claves como `app-error`, `app-success`, `app-warning` en el mismo objeto `app`.
