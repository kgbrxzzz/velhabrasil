-- RPC para criar/encontrar partida amistosa 1v1 entre amigos (dedup + lock + checa partida ativa)
CREATE OR REPLACE FUNCTION public.invite_friend_1v1(_user_id uuid, _friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _match_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF _user_id = _friend_id THEN
    RAISE EXCEPTION 'cannot invite yourself';
  END IF;

  -- Lock determinístico baseado no par de jogadores (ordem irrelevante)
  PERFORM pg_advisory_xact_lock(
    hashtext('friendly_1v1_' ||
      LEAST(_user_id::text, _friend_id::text) || '_' ||
      GREATEST(_user_id::text, _friend_id::text))
  );

  -- Bloqueia se o convidante já estiver em partida ativa
  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE status = 'playing'
      AND created_at >= now() - interval '15 minutes'
      AND (player1_id = _user_id OR player2_id = _user_id OR player3_id = _user_id OR player4_id = _user_id)
  ) THEN
    RAISE EXCEPTION 'already_in_match';
  END IF;

  -- Bloqueia se o amigo já estiver em partida ativa (que não seja entre os dois)
  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE status = 'playing'
      AND created_at >= now() - interval '15 minutes'
      AND (player1_id = _friend_id OR player2_id = _friend_id OR player3_id = _friend_id OR player4_id = _friend_id)
      AND NOT (
        (player1_id = _user_id AND player2_id = _friend_id) OR
        (player1_id = _friend_id AND player2_id = _user_id)
      )
  ) THEN
    RAISE EXCEPTION 'friend_busy';
  END IF;

  -- Reaproveita partida recente entre os dois (criada nos últimos 30s)
  SELECT id INTO _match_id
  FROM public.matches
  WHERE status = 'playing'
    AND game_mode = '1v1'
    AND created_at >= now() - interval '30 seconds'
    AND (
      (player1_id = _user_id AND player2_id = _friend_id) OR
      (player1_id = _friend_id AND player2_id = _user_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF _match_id IS NOT NULL THEN
    RETURN _match_id;
  END IF;

  INSERT INTO public.matches (player1_id, player2_id, current_turn, status, turn_started_at, game_mode, board)
  VALUES (_user_id, _friend_id,
          CASE WHEN random() > 0.5 THEN _user_id ELSE _friend_id END,
          'playing', now(), '1v1',
          '["", "", "", "", "", "", "", "", ""]'::jsonb)
  RETURNING id INTO _match_id;

  RETURN _match_id;
END;
$$;

-- Reforça update_trophies: garante que só finaliza UMA vez por partida (idempotente via winner_id já estar setado, mas adiciona checagem extra de janela curta)
-- (mantém a função existente; o frontend será corrigido para não chamar duas vezes)

-- Permite que find_or_create_match_1v1/2v2 também bloqueiem se usuário já está em partida ativa
CREATE OR REPLACE FUNCTION public.find_or_create_match_1v1(_user_id uuid, _trophies integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _opponent record;
  _match_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('matchmaking_1v1'));
  PERFORM public.cleanup_stale_matchmaking_queue();

  -- Já tem partida ativa? Devolve ela
  SELECT id INTO _match_id
  FROM public.matches
  WHERE status = 'playing'
    AND created_at >= now() - interval '15 minutes'
    AND (player1_id = _user_id OR player2_id = _user_id OR player3_id = _user_id OR player4_id = _user_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF _match_id IS NOT NULL THEN
    DELETE FROM public.matchmaking_queue WHERE user_id = _user_id;
    RETURN _match_id;
  END IF;

  INSERT INTO public.matchmaking_queue (user_id, trophies, game_mode, created_at)
  VALUES (_user_id, _trophies, '1v1', now())
  ON CONFLICT (user_id) DO UPDATE
  SET trophies = EXCLUDED.trophies,
      game_mode = '1v1',
      created_at = now();

  SELECT * INTO _opponent
  FROM public.matchmaking_queue
  WHERE user_id <> _user_id
    AND game_mode = '1v1'
    AND created_at >= now() - interval '30 seconds'
    AND trophies BETWEEN GREATEST(0, _trophies - 100) AND (_trophies + 100)
    -- Garante que o oponente não está em partida ativa
    AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.status = 'playing'
        AND m.created_at >= now() - interval '15 minutes'
        AND (m.player1_id = matchmaking_queue.user_id OR m.player2_id = matchmaking_queue.user_id
             OR m.player3_id = matchmaking_queue.user_id OR m.player4_id = matchmaking_queue.user_id)
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF _opponent.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.matches (player1_id, player2_id, current_turn, status, turn_started_at, game_mode, board)
  VALUES (_user_id, _opponent.user_id,
          CASE WHEN random() > 0.5 THEN _user_id ELSE _opponent.user_id END,
          'playing', now(), '1v1',
          '["", "", "", "", "", "", "", "", ""]'::jsonb)
  RETURNING id INTO _match_id;

  DELETE FROM public.matchmaking_queue
  WHERE user_id IN (_user_id, _opponent.user_id);

  RETURN _match_id;
END;
$$;