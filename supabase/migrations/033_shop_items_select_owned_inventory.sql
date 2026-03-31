-- Permitir ver metadatos de artículos de tienda que el usuario ya tiene en inventario.
-- Sin esto, si is_active = false el embed shop_items(*) en user_inventory devuelve null
-- y el cliente puede fallar al mapear, mostrando inventario vacío pese a tener filas.

CREATE POLICY "shop_items: leer si está en mi inventario" ON public.shop_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_inventory ui
      WHERE ui.item_id = shop_items.id
        AND ui.user_id = auth.uid()
    )
  );
