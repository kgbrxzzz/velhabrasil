CREATE OR REPLACE FUNCTION public.find_or_create_match_1v1(_user_id uuid, _trophies integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT id INTO _match_id
  FROM public.matches
  WHERE status = 'playing'
    AND game_mode = '1v1'
    AND created_at >= now() - interval '30 seconds'
    AND (player1_id = _user_id OR player2_id = _user_id)
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
  ORDER BY created_at ASC
  LIMIT 1;

  IF _opponent.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.matches (player1_id, player2_id, current_turn, status, turn_started_at, game_mode, board)
  VALUES (_user_id, _opponent.user_id, CASE WHEN random() > 0.5 THEN _user_id ELSE _opponent.user_id END, 'playing', now(), '1v1', '["", "", "", "", "", "", "", "", ""]'::jsonb)
  RETURNING id INTO _match_id;

  DELETE FROM public.matchmaking_queue
  WHERE user_id IN (_user_id, _opponent.user_id);

  RETURN _match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_match_2v2(_user_id uuid, _trophies integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _players uuid[];
  _p2 uuid;
  _p3 uuid;
  _p4 uuid;
  _turn_order jsonb;
  _first_player uuid;
  _match_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('matchmaking_2v2'));
  PERFORM public.cleanup_stale_matchmaking_queue();

  SELECT id INTO _match_id
  FROM public.matches
  WHERE status = 'playing'
    AND game_mode = '2v2'
    AND created_at >= now() - interval '30 seconds'
    AND (player1_id = _user_id OR player2_id = _user_id OR player3_id = _user_id OR player4_id = _user_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF _match_id IS NOT NULL THEN
    DELETE FROM public.matchmaking_queue WHERE user_id = _user_id;
    RETURN _match_id;
  END IF;

  INSERT INTO public.matchmaking_queue (user_id, trophies, game_mode, created_at)
  VALUES (_user_id, _trophies, '2v2', now())
  ON CONFLICT (user_id) DO UPDATE
  SET trophies = EXCLUDED.trophies,
      game_mode = '2v2',
      created_at = now();

  SELECT array_agg(user_id ORDER BY created_at ASC) INTO _players
  FROM (
    SELECT user_id, created_at
    FROM public.matchmaking_queue
    WHERE user_id <> _user_id
      AND game_mode = '2v2'
      AND created_at >= now() - interval '30 seconds'
      AND trophies BETWEEN GREATEST(0, _trophies - 150) AND (_trophies + 150)
    ORDER BY created_at ASC
    LIMIT 3
  ) q;

  IF _players IS NULL OR array_length(_players, 1) < 3 THEN
    RETURN NULL;
  END IF;

  _p2 := _players[1];
  _p3 := _players[2];
  _p4 := _players[3];

  IF random() > 0.5 THEN
    _turn_order := jsonb_build_array(_user_id, _p2, _p3, _p4);
    _first_player := _user_id;
  ELSE
    _turn_order := jsonb_build_array(_p2, _user_id, _p4, _p3);
    _first_player := _p2;
  END IF;

  INSERT INTO public.matches (player1_id, player2_id, player3_id, player4_id, current_turn, status, turn_started_at, game_mode, board, turn_order)
  VALUES (_user_id, _p2, _p3, _p4, _first_player, 'playing', now(), '2v2', to_jsonb(array_fill(''::text, ARRAY[25])), _turn_order)
  RETURNING id INTO _match_id;

  DELETE FROM public.matchmaking_queue
  WHERE user_id IN (_user_id, _p2, _p3, _p4);

  RETURN _match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_match_1v1(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_or_create_match_2v2(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_match_1v1(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_match_2v2(uuid, integer) TO authenticated;