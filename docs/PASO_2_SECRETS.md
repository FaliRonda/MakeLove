# Paso 2: Añadir los secrets en Supabase

1. En el **Dashboard** de Supabase, con el proyecto **MakeLove** abierto:
   - **Opción A:** En el menú lateral izquierdo (fuera de Settings) haz clic en **"Edge Functions"**. Si existe, dentro suele haber **"Manage secrets"** o un icono de variables/secretos.
   - **Opción B:** Haz clic en el **engranaje (Project Settings)** en la parte inferior del menú izquierdo. Dentro de Settings, en la columna izquierda busca **"Edge Functions"** y entra. Ahí verás la sección **Secrets**.

3. Dentro de **Edge Functions** (o **Functions**), busca la sección **"Secrets"** o **"Manage secrets"** / **"Environment variables"**.

4. Añade estos dos secrets (nombre exacto y valor):

   | Name               | Value |
   |--------------------|--------|
   | `VAPID_PUBLIC_KEY` | `BAt8vg5HPBzkYCRQ4Urg5kRnLNg_5spSFJEwh0t4VVT4bi1dMNIHcGKf868O-QPnZOXPoCQTmDVUAuvVpaFjpmk` |
   | `VAPID_PRIVATE_KEY`| `gnX1sdEKpc_ojRGPGhCyCEa85Bz5iibgz2r9FYKiCaI` |

5. Guarda los cambios.

**Nota:** Si en tu plan no ves "Edge Functions" o "Secrets", es posible que primero tengas que desplegar una función (por ejemplo desde la pestaña **Edge Functions** del menú principal, no dentro de Settings). En ese caso, despliega la función `send-push` y luego en esa función suele haber un botón o enlace para **"Secrets"** o **"Environment variables"** de esa función.
