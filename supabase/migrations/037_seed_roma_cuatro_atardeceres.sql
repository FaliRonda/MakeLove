-- MakeLove - Historia "Cuatro atardeceres en Roma" + tienda temática.
-- Idempotente por nombre de historia (borra y vuelve a insertar).

DO $roma$
DECLARE
  sid       uuid;
  c1        uuid;
  c2        uuid;
  c3        uuid;
  c4        uuid;
  m11       uuid;
  m12       uuid;
  m21       uuid;
  m22       uuid;
  m31       uuid;
  m32       uuid;
  m41       uuid;
  m42       uuid;
  m43        uuid;
  rome_frame uuid;
  rome_badge uuid;
BEGIN
  DELETE FROM public.stories WHERE name = 'Cuatro atardeceres en Roma';

  DELETE FROM public.shop_items si
  WHERE si.name IN (
    'Insignia Roma · Cuatro atardeceres',
    'Color Roma · Travertino',
    'Color Roma · Hora dorada en el Tíber',
    'Insignia · Gelato del día',
    'Insignia · Noche en Trastevere',
    'Medalla · Primer amanecer romano',
    'Medalla · Equipo en la cola del Coliseo',
    'Marco · Máscara veneciana'
  )
  AND NOT EXISTS (SELECT 1 FROM public.user_inventory ui WHERE ui.item_id = si.id);

  -- Marco: premio al completar la historia (visible en tienda, no comprable)
  INSERT INTO public.shop_items (
    name, description, item_type, color_value, badge_symbol, cost_piedritas,
    is_purchasable, is_temporary, available_until, is_couple_item, is_active, sort_order, frame_overlay_url
  ) VALUES (
    'Marco · Máscara veneciana',
    'Premio al completar todas las misiones de «Cuatro atardeceres en Roma». También podés verlo en la tienda como referencia; no se compra con Piedritas.',
    'avatar_frame',
    NULL,
    '🎭',
    0,
    false,
    false,
    NULL,
    false,
    true,
    60,
    '/shop/venetian-mask.png'
  ) RETURNING id INTO rome_frame;

  -- Insignia Roma: comprable en tienda (y coherente con la temática de la historia)
  INSERT INTO public.shop_items (
    name, description, item_type, color_value, badge_symbol, cost_piedritas,
    is_purchasable, is_temporary, available_until, is_couple_item, is_active, sort_order
  ) VALUES (
    'Insignia Roma · Cuatro atardeceres',
    'La insignia del viaje compartido. Podés comprarla aquí en tienda.',
    'badge',
    NULL,
    '🏛️',
    55,
    true,
    false,
    NULL,
    false,
    true,
    5
  ) RETURNING id INTO rome_badge;

  -- Tienda temática (comprables)
  INSERT INTO public.shop_items (
    name, description, item_type, color_value, badge_symbol, cost_piedritas,
    is_purchasable, is_temporary, available_until, is_couple_item, is_active, sort_order, frame_overlay_url
  ) VALUES
  (
    'Color Roma · Travertino',
    'Tono piedra cálida, como las fachadas al sol.',
    'name_color',
    '#d4c4b0',
    NULL,
    28,
    true,
    true,
    '2026-04-30',
    false,
    true,
    12,
    NULL
  ),
  (
    'Color Roma · Hora dorada en el Tíber',
    'Ámbar suave para el nombre; inspirado en el último rayo sobre el agua.',
    'name_color',
    '#c9956b',
    NULL,
    32,
    true,
    true,
    '2026-04-30',
    false,
    true,
    13,
    NULL
  ),
  (
    'Insignia · Gelato del día',
    'Un día en Roma siempre huele a algo dulce.',
    'badge',
    NULL,
    '🍦',
    26,
    true,
    true,
    '2026-04-30',
    false,
    true,
    22,
    NULL
  ),
  (
    'Insignia · Noche en Trastevere',
    'Cuando la ciudad baja el ritmo y sube la conversación.',
    'badge',
    NULL,
    '🌙',
    30,
    true,
    true,
    '2026-04-30',
    false,
    true,
    23,
    NULL
  ),
  (
    'Medalla · Primer amanecer romano',
    'Por levantarse y elegirse otra vez en la misma aventura.',
    'medal',
    NULL,
    '🌅',
    38,
    true,
    true,
    '2026-04-30',
    false,
    true,
    32,
    NULL
  ),
  (
    'Medalla · Equipo en la cola del Coliseo',
    'Paciencia compartida, foto merecida.',
    'medal',
    NULL,
    '⏳',
    42,
    true,
    true,
    '2026-04-30',
    false,
    true,
    33,
    NULL
  );

  INSERT INTO public.stories (name, description, start_date, end_date, status)
  VALUES (
    'Cuatro atardeceres en Roma',
    'Cuatro días en Roma para que el viaje sea de dos: gestos entre monumentos, pedir ayuda cuando el día aprieta y cerrar con un recuerdo que sea vuestro, no solo postal.',
    '2026-04-05',
    '2026-04-08',
    'active'
  ) RETURNING id INTO sid;

  INSERT INTO public.chapters (story_id, name, order_number, start_date, end_date)
  VALUES (sid, 'Día 1 · Fiume y primer café', 1, '2026-04-05', '2026-04-05')
  RETURNING id INTO c1;

  INSERT INTO public.chapters (story_id, name, order_number, start_date, end_date)
  VALUES (sid, 'Día 2 · Piedras que susurran', 2, '2026-04-06', '2026-04-06')
  RETURNING id INTO c2;

  INSERT INTO public.chapters (story_id, name, order_number, start_date, end_date)
  VALUES (sid, 'Día 3 · La ciudad que no perdona', 3, '2026-04-07', '2026-04-07')
  RETURNING id INTO c3;

  INSERT INTO public.chapters (story_id, name, order_number, start_date, end_date)
  VALUES (sid, 'Día 4 · Última luz sobre el Tíber', 4, '2026-04-08', '2026-04-08')
  RETURNING id INTO c4;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c1, 1,
    'Llegamos, existimos',
    'El viaje empieza cuando os miráis, no cuando aterrizáis. Registrad juntos las primeras acciones del día.',
    'couple', 25, NULL
  ) RETURNING id INTO m11;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c1, 2,
    'La primera “pregunta romana”',
    'Pedid algo explícito al otro (un detalle, un plan, un abrazo de cinco minutos). Que sea la primera solicitud confirmada entre vosotros hoy.',
    'couple', 20, NULL
  ) RETURNING id INTO m12;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c2, 1,
    'Historia compartida',
    'Entre foro y café, acumulad gestos registrados; el día es largo y la ciudad también.',
    'couple', 30, NULL
  ) RETURNING id INTO m21;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c2, 2,
    'El sí del otro',
    'Que hoy al menos una petición vuestra acabe en “hecho”.',
    'couple', 25, NULL
  ) RETURNING id INTO m22;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c3, 1,
    'Turista con piernas',
    'Colas, calor, opiniones: contad acciones entre los dos. Estáis aquí los dos.',
    'couple', 35, NULL
  ) RETURNING id INTO m31;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c3, 2,
    'Cuando el caos aprieta, se pide',
    'Enviad solicitudes confirmadas; compartido entre los dos cuenta para la pareja.',
    'couple', 35, NULL
  ) RETURNING id INTO m32;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c4, 1,
    'Decimos sí con hechos',
    'Hoy cumplís con peticiones del otro: que se confirmen al menos dos en pareja.',
    'couple', 30, NULL
  ) RETURNING id INTO m41;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c4, 2,
    'Preludio de cierre',
    'Habéis completado al menos cuatro de las seis misiones de los tres primeros días. El ritmo importa más que la perfección.',
    'couple', 40, NULL
  ) RETURNING id INTO m42;

  INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas, reward_shop_item_id)
  VALUES (
    c4, 3,
    'Roma cerrada',
    'Las siete misiones de contenido completas: los seis primeros días de desafío más el cierre de hoy. Reclamá el marco «Máscara veneciana» (premio de historia; no se compra en tienda).',
    'couple', 0, rome_frame
  ) RETURNING id INTO m43;

  INSERT INTO public.mission_requirements (mission_id, metric_type, required_amount, prior_mission_ids) VALUES
    (m11, 'actions_done', 2, NULL),
    (m12, 'requests_sent_confirmed', 1, NULL),
    (m21, 'actions_done', 2, NULL),
    (m22, 'requests_received_confirmed', 2, NULL),
    (m31, 'actions_done', 2, NULL),
    (m32, 'requests_sent_confirmed', 2, NULL),
    (m41, 'requests_received_confirmed', 2, NULL),
    (m42, 'prior_missions_complete', 4, ARRAY[m11, m12, m21, m22, m31, m32]),
    (m43, 'prior_missions_complete', 7, ARRAY[m11, m12, m21, m22, m31, m32, m41]);

END $roma$;
