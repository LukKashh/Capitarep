CREATE TABLE public.player_states (
  user_id uuid PRIMARY KEY,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_states TO authenticated;
GRANT ALL ON public.player_states TO service_role;
ALTER TABLE public.player_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own state read" ON public.player_states FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  corp_id uuid,
  type text NOT NULL,
  source text NOT NULL,
  destination text NOT NULL,
  amount numeric NOT NULL,
  entity text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user_idx ON public.ledger(user_id, created_at DESC);
GRANT SELECT ON public.ledger TO authenticated;
GRANT ALL ON public.ledger TO service_role;
GRANT USAGE ON SEQUENCE public.ledger_id_seq TO service_role;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.action_keys (
  user_id uuid NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT ALL ON public.action_keys TO service_role;
ALTER TABLE public.action_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.corporations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  founder_id uuid NOT NULL,
  recruitment text NOT NULL DEFAULT 'open',
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  dissolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX corp_name_active ON public.corporations(lower(name)) WHERE dissolved_at IS NULL;
CREATE UNIQUE INDEX corp_founder_active ON public.corporations(founder_id) WHERE dissolved_at IS NULL;
GRANT ALL ON public.corporations TO service_role;
ALTER TABLE public.corporations ENABLE ROW LEVEL SECURITY;

-- Atomic commit of a game action: optimistic version checks + idempotency + ledger
CREATE OR REPLACE FUNCTION public.commit_game_action(
  p_user uuid, p_key text, p_expected int, p_state jsonb,
  p_corp uuid, p_corp_expected int, p_corp_state jsonb, p_corp_dissolve boolean,
  p_ledger jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO action_keys(user_id, key) VALUES (p_user, p_key) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN 'duplicate'; END IF;

  IF p_expected = 0 THEN
    INSERT INTO player_states(user_id, state) VALUES (p_user, p_state) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    UPDATE player_states SET state = p_state, version = version + 1, updated_at = now()
      WHERE user_id = p_user AND version = p_expected;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  IF n = 0 THEN RAISE EXCEPTION 'conflict'; END IF;

  IF p_corp IS NOT NULL AND p_corp_state IS NOT NULL THEN
    UPDATE corporations SET state = p_corp_state, version = version + 1,
      recruitment = coalesce(p_corp_state->>'recruitment', recruitment),
      dissolved_at = CASE WHEN p_corp_dissolve THEN now() ELSE dissolved_at END
      WHERE id = p_corp AND version = p_corp_expected AND dissolved_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'conflict'; END IF;
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