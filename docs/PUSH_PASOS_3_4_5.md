# Push notifications – Pasos 3, 4 y 5

## Paso 3: Crear la tabla `push_subscriptions`

1. En el Dashboard de Supabase, ve a **SQL Editor** (menú izquierdo).
2. Pulsa **New query**.
3. Copia y pega **todo** el SQL de abajo.
4. Pulsa **Run** (o Ctrl+Enter).

```sql
-- Suscripciones para push notifications (Web Push)
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Push: insertar propias" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Push: ver propias" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Push: eliminar propias" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

Si ya aplicaste esta migración antes, verás un error tipo "table already exists"; en ese caso puedes ignorarlo.

---

## Paso 4: Desplegar la Edge Function `send-push`

Usa **npx supabase** (no hace falta instalar la CLI global; `npm install -g supabase` no está soportado).

1. En la terminal, desde la carpeta del proyecto:
   ```bash
   cd c:\Workspace\MakeLove
   npx supabase link --project-ref grmxwgsnmifroxsjqguz
   ```
   Te pedirá la **contraseña de la base de datos** (en **Project Settings → Database → Database password**).

2. Despliega la función:
   ```bash
   npx supabase functions deploy send-push --no-verify-jwt
   ```

Si prefieres no usar la CLI, en el Dashboard ve a **Edge Functions → Functions** y comprueba si puedes desplegar desde ahí (depende del plan).

---

## Paso 5: Crear el webhook en la base de datos

1. En el Dashboard, ve a **Database** → **Webhooks** (o **Integrations** → **Database Webhooks**).
2. Pulsa **Create a new hook** (o **Create webhook**).
3. Configura:
   - **Name:** p. ej. `Push al insertar notificación`
   - **Table:** `public.notifications` o solo `notifications`
   - **Events:** marca **Insert** (solo este).
   - **Type / Webhook type:** **Supabase Edge Function**.
   - **Edge Function:** elige **send-push**.
   - Si te pide "Authorization" o "Headers", añade el header con la **service_role key** (en **Project Settings → API** está la clave "service_role" secret; úsala como `Authorization: Bearer <service_role_key>` si el formulario lo permite).
4. Guarda el webhook.

Cuando alguien reciba una notificación en la app (INSERT en `notifications`), el webhook llamará a `send-push` y se enviará el push al usuario.
