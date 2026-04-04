-- MakeLove - Ajuste fechas historia Roma: 5 → 8 de abril (Europe/Madrid calendario de capítulos).
-- Idempotente: solo afecta la historia con este nombre exacto.

UPDATE public.stories
SET start_date = '2026-04-05',
    end_date   = '2026-04-08'
WHERE name = 'Cuatro atardeceres en Roma';

UPDATE public.chapters c
SET
  start_date = v.d,
  end_date   = v.d
FROM public.stories s
JOIN (VALUES
  (1, '2026-04-05'::date),
  (2, '2026-04-06'::date),
  (3, '2026-04-07'::date),
  (4, '2026-04-08'::date)
) AS v(ord, d) ON true
WHERE s.name = 'Cuatro atardeceres en Roma'
  AND c.story_id = s.id
  AND c.order_number = v.ord;
