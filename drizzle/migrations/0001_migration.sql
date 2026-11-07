ALTER TABLE public.player_states ADD COLUMN username text;
CREATE UNIQUE INDEX player_username_unique ON public.player_states(lower(username)) WHERE username IS NOT NULL;

CREATE TABLE public.collectible_stock (
  item_id text PRIMARY KEY,
  sold integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.collectible_stock TO authenticated;
GRANT ALL ON public.collectible_stock TO service_role;
ALTER TABLE public.collectible_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock readable" ON public.collectible_stock FOR SELECT TO authenticated USING (true);

DROP FUNCTION public.commit_game_action(uuid, text, int, jsonb, uuid, int, jsonb, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.commit_game_action(
  p_user uuid, p_key text, p_expected int, p_state jsonb,
  p_corp uuid, p_corp_expected int, p_corp_state jsonb, p_corp_dissolve boolean,
  p_ledger jsonb, p_stock jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; s jsonb;
BEGIN
  INSERT INTO action_keys(user_id, key) VALUES (p_user, p_key) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN 'duplicate'; END IF;

  IF p_expected = 0 THEN
    INSERT INTO player_states(user_id, state, username) VALUES (p_user, p_state, NULLIF(p_state->>'username',''))
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    UPDATE player_states SET state = p_state, version = version + 1, updated_at = now(),
      username = NULLIF(p_state->>'username','')
      WHERE user_id = p_user AND version = p_expected;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  IF n = 0 THEN RAISE EXCEPTION 'conflict'; END IF;

  IF p_corp IS NOT NULL AND p_corp_state IS NOT NULL THEN
    IF p_corp_expected = 0 THEN
      INSERT INTO corporations(id, name, tag, founder_id, recruitment, state)
      VALUES (p_corp, p_corp_state->>'name', p_corp_state->>'tag', p_user,
              coalesce(p_corp_state->>'recruitment','open'), p_corp_state);
    ELSE
      UPDATE corporations SET state = p_corp_state, version = version + 1,
        recruitment = coalesce(p_corp_state->>'recruitment', recruitment),
        dissolved_at = CASE WHEN p_corp_dissolve THEN now() ELSE dissolved_at END
        WHERE id = p_corp AND version = p_corp_expected AND dissolved_at IS NULL;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE EXCEPTION 'conflict'; END IF;
    END IF;
  END IF;

  IF p_stock IS NOT NULL THEN
    FOR s IN SELECT * FROM jsonb_array_elements(p_stock) LOOP
      INSERT INTO collectible_stock(item_id, sold) VALUES (s->>'item', 0) ON CONFLICT DO NOTHING;
      UPDATE collectible_stock SET sold = sold + (s->>'qty')::int
        WHERE item_id = s->>'item' AND sold + (s->>'qty')::int <= (s->>'max')::int;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE EXCEPTION 'sold_out'; END IF;
    END LOOP;
  END IF;

  IF p_ledger IS NOT NULL AND jsonb_array_length(p_ledger) > 0 THEN
    INSERT INTO ledger(user_id, corp_id, type, source, destination, amount, entity, meta)
    SELECT p_user, NULLIF(e->>'corp_id','')::uuid, e->>'type', e->>'source', e->>'destination',
           (e->>'amount')::numeric, e->>'entity', e->'meta'
    FROM jsonb_array_elements(p_ledger) e;
  END IF;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.commit_game_action FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_game_action TO service_role;