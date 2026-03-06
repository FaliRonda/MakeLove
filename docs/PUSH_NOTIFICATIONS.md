# Configurar Push Notifications – Pasos

Sigue estos pasos en orden. Las claves VAPID ya están generadas en el archivo **`push-keys.txt`** (en la raíz del proyecto); úsalas en los pasos 1 y 2.

---

## Paso 1: Clave pública en el frontend

1. Abre tu archivo **`.env`** (junto a `.env.example`; si no existe, cópialo desde `.env.example`).
2. Añade esta línea (copia la clave pública desde **`push-keys.txt`**):

   ```
   VITE_VAPID_PUBLIC_KEY=BAt8vg5HPBzkYCRQ4Urg5kRnLNg_5spSFJEwh0t4VVT4bi1dMNIHcGKf868O-QPnZOXPoCQTmDVUAuvVpaFjpmk
   ```

3. Guarda el archivo y reinicia el servidor de desarrollo (`npm run dev`) si estaba en marcha.

---

## Paso 2: Claves en Supabase (Edge Function)

1. Entra en **[Supabase Dashboard](https://supabase.com/dashboard)** y abre tu proyecto.
2. Ve a **Project Settings** (icono de engranaje) → **Edge Functions**.
3. En **Secrets**, añade dos variables:
   - **Name:** `VAPID_PUBLIC_KEY`  
     **Value:** `BAt8vg5HPBzkYCRQ4Urg5kRnLNg_5spSFJEwh0t4VVT4bi1dMNIHcGKf868O-QPnZOXPoCQTmDVUAuvVpaFjpmk`
   - **Name:** `VAPID_PRIVATE_KEY`  
     **Value:** `gnX1sdEKpc_ojRGPGhCyCEa85Bz5iibgz2r9FYKiCaI` (cópiala desde `push-keys.txt`)

4. Guarda.  
(Opcional: después puedes borrar **`push-keys.txt`** para no dejar la clave privada en el proyecto.)

---

## Paso 3: Tabla `push_subscriptions` en la base de datos

Tienes dos opciones:

### Opción A – Con Supabase CLI (si la tienes instalada)

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

### Opción B – Desde el Dashboard (SQL)

1. En el Dashboard, ve a **SQL Editor**.
2. Crea una nueva query y pega el contenido del archivo **`supabase/migrations/012_push_subscriptions.sql`**.
3. Ejecuta la query (Run).

---

## Paso 4: Desplegar la Edge Function `send-push`

Solo si tienes **Supabase CLI** instalada y el proyecto enlazado:

```bash
supabase functions deploy send-push --no-verify-jwt
```

Si no usas CLI, puedes desplegar la función desde el Dashboard (si tu plan lo permite) o seguir la [documentación de Supabase](https://supabase.com/docs/guides/functions) para desplegar `supabase/functions/send-push`.

---

## Paso 5: Webhook en la base de datos

1. En el Dashboard, ve a **Database** → **Webhooks** (o **Integrations** → **Database Webhooks**).
2. Pulsa **Create a new hook**.
3. Configura:
   - **Name:** p. ej. `Enviar push al insertar notificación`
   - **Table:** `notifications`
   - **Events:** marca solo **Insert**
   - **Type:** Supabase Edge Function
   - **Edge Function:** `send-push`
   - Si te pide autorización, añade el header con la **service role key** (Project Settings → API).
4. Guarda el webhook.

---

## Comprobar que funciona

1. Abre la app en el navegador, inicia sesión y **acepta** cuando pida permiso para notificaciones.
2. Desde otro usuario (u otra ventana), dispara una acción que cree una notificación para ese usuario (p. ej. enviar una solicitud).
3. Deberías recibir una notificación push en el dispositivo/navegador del primer usuario.

Si algo falla, revisa los logs de la Edge Function en el Dashboard (Edge Functions → `send-push` → Logs) y que los Secrets estén bien configurados.
