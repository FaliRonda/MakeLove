-- MakeLove - Seed: Historia "El Despertar" + Insignia de Marzo
-- Ejecutar en Supabase SQL Editor.

WITH
  story AS (
    INSERT INTO public.stories (name, description, start_date, end_date, status)
    VALUES (
      'El Despertar',
      'Toda historia de amor tiene un comienzo: ese instante en que dos cuerpos y dos mentes deciden encontrarse. El Despertar es vuestro primer preludio juntos, una invitación suave a explorar el placer de dar y recibir. Completad las misiones, reclamad vuestras Piedritas y dejad que el fuego crezca.',
      '2026-03-26',
      '2026-03-31',
      'active'
    )
    RETURNING id
  ),

  chapter AS (
    INSERT INTO public.chapters (story_id, name, order_number, start_date, end_date)
    SELECT id, 'Acto I: La Chispa', 1, '2026-03-26', '2026-03-31'
    FROM story
    RETURNING id
  ),

  mission1 AS (
    INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas)
    SELECT
      id, 1,
      'El Primer Gesto',
      'Realizad una acción hacia vuestra pareja. No importa cuál: un masaje, una caricia, un instante de atención plena. El primer movimiento siempre es el más especial.',
      'individual', 20
    FROM chapter
    RETURNING id
  ),

  mission2 AS (
    INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas)
    SELECT
      id, 2,
      'La Primera Solicitud',
      'Atrévete a pedir. Envía una solicitud a tu pareja y espera a que la confirme. La vulnerabilidad de desear en voz alta es, en sí misma, una forma de intimidad.',
      'individual', 10
    FROM chapter
    RETURNING id
  ),

  mission3 AS (
    INSERT INTO public.missions (chapter_id, order_number, title, description, target_type, reward_piedritas)
    SELECT
      id, 3,
      'El Primer Sí',
      'Acepta una solicitud de tu pareja y llévala a cabo. Decir sí con todo el cuerpo es uno de los actos más poderosos del amor.',
      'individual', 15
    FROM chapter
    RETURNING id
  ),

  req1 AS (
    INSERT INTO public.mission_requirements (mission_id, metric_type, required_amount)
    SELECT id, 'actions_done', 1 FROM mission1
    RETURNING mission_id
  ),

  req2 AS (
    INSERT INTO public.mission_requirements (mission_id, metric_type, required_amount)
    SELECT id, 'requests_sent_confirmed', 1 FROM mission2
    RETURNING mission_id
  ),

  req3 AS (
    INSERT INTO public.mission_requirements (mission_id, metric_type, required_amount)
    SELECT id, 'requests_received_confirmed', 1 FROM mission3
    RETURNING mission_id
  ),

  shop AS (
    INSERT INTO public.shop_items
      (name, description, item_type, badge_symbol, cost_piedritas, is_temporary, available_until, sort_order)
    VALUES (
      'Insignia de Marzo · La Chispa',
      'Reconocimiento por iniciar el amor. Otorgada a quienes encendieron la llama en las primeras misiones de El Despertar.',
      'badge',
      '🌸',
      45,
      true,
      '2026-03-31',
      1
    )
    RETURNING id
  )

-- Devuelve los IDs insertados para verificación
SELECT
  story.id        AS story_id,
  chapter.id      AS chapter_id,
  mission1.id     AS mission1_id,
  mission2.id     AS mission2_id,
  mission3.id     AS mission3_id,
  shop.id         AS shop_item_id
FROM story, chapter, mission1, mission2, mission3, req1, req2, req3, shop;
