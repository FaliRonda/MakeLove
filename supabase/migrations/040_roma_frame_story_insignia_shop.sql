-- Marco «Máscara veneciana» = premio al completar la historia (no comprable, visible en tienda).
-- «Insignia Roma · Cuatro atardeceres» = comprable en tienda.

UPDATE public.shop_items
SET
  is_purchasable = false,
  cost_piedritas = 0,
  description =
    'Premio al completar todas las misiones de «Cuatro atardeceres en Roma». Visible en tienda como referencia; no se compra con Piedritas.'
WHERE name = 'Marco · Máscara veneciana';

UPDATE public.shop_items
SET
  is_purchasable = true,
  cost_piedritas = 55,
  description = 'La insignia del viaje compartido. Podés comprarla aquí en tienda.'
WHERE name = 'Insignia Roma · Cuatro atardeceres';

UPDATE public.missions m
SET
  reward_shop_item_id = (SELECT id FROM public.shop_items WHERE name = 'Marco · Máscara veneciana' LIMIT 1),
  description =
    'Las siete misiones de contenido completas: los seis primeros días de desafío más el cierre de hoy. Reclamá el marco «Máscara veneciana» (premio de historia; no se compra en tienda).'
WHERE m.title = 'Roma cerrada';
