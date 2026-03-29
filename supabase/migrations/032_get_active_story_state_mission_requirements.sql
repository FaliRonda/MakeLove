-- MakeLove - get_active_story_state: incluye requirements (metric_type + required_amount)
--             para textos de objetivo en la app.

CREATE OR REPLACE FUNCTION public.get_active_story_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_today date        := (timezone('Europe/Madrid', v_now))::date;
  v_story record;
  v_partner uuid;
BEGIN
  SELECT * INTO v_story
  FROM public.stories s
  WHERE s.start_date <= v_today AND s.end_date >= v_today
  ORDER BY s.start_date ASC
  LIMIT 1;

  IF v_story.id IS NULL THEN
    SELECT * INTO v_story
    FROM public.stories s
    WHERE s.start_date > v_today
    ORDER BY s.start_date ASC
    LIMIT 1;
  END IF;

  SELECT partner_user_id INTO v_partner
  FROM public.get_active_couple_partner(p_user_id) t
  LIMIT 1;

  RETURN jsonb_build_object(
    'as_of',           v_now,
    'user_id',         p_user_id,
    'partner_user_id', v_partner,
    'story', CASE WHEN v_story.id IS NULL THEN null ELSE jsonb_build_object(
      'id',          v_story.id,
      'name',        v_story.name,
      'description', v_story.description,
      'start_date',  v_story.start_date,
      'end_date',    v_story.end_date
    ) END,
    'chapters', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           c.id,
          'name',         c.name,
          'order_number', c.order_number,
          'start_date',   c.start_date,
          'end_date',     c.end_date,
          'missions', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',               m.id,
                'order_number',     m.order_number,
                'title',            m.title,
                'description',      m.description,
                'target_type',      m.target_type,
                'reward_piedritas', m.reward_piedritas,
                'requirements', COALESCE((
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'metric_type', mr.metric_type,
                      'required_amount', mr.required_amount
                    )
                    ORDER BY mr.id
                  )
                  FROM public.mission_requirements mr
                  WHERE mr.mission_id = m.id
                ), '[]'::jsonb),
                'claimed', EXISTS(
                  SELECT 1
                  FROM public.user_story_mission_claims cm
                  WHERE cm.user_id = p_user_id AND cm.mission_id = m.id
                ),
                'progress', (
                  SELECT jsonb_build_object(
                    'is_complete',    prog.is_complete,
                    'progress_value', prog.progress_value,
                    'progress_target', prog.progress_target
                  )
                  FROM public._mission_progress_as_of(p_user_id, m.id, v_now) prog
                  LIMIT 1
                )
              )
              ORDER BY m.order_number ASC
            )
            FROM public.missions m
            WHERE m.chapter_id = c.id
          )
        )
        ORDER BY c.order_number ASC
      )
      FROM public.chapters c
      WHERE c.story_id = v_story.id
    ), '[]'::jsonb)
  );
END;
$$;
