
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_friendly boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.invite_friend_1v1(_user_id uuid, _friend_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _match_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF _user_id = _friend_id THEN
    RAISE EXCEPTION 'cannot invite yourself';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('friendly_1v1_' ||
      LEAST(_user_id::text, _friend_id::text) || '_' ||
      GREATEST(_user_id::text, _friend_id::text))
  );

  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE status = 'playing'
      AND created_at >= now() - interval '15 minutes'
      AND (player1_id = _user_id OR player2_id = _user_id OR player3_id = _user_id OR player4_id = _user_id)
  ) THEN
    RAISE EXCEPTION 'already_in_match';
  END IF;

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

  INSERT INTO public.matches (player1_id, player2_id, current_turn, status, turn_started_at, game_mode, board, is_friendly)
  VALUES (_user_id, _friend_id,
          CASE WHEN random() > 0.5 THEN _user_id ELSE _friend_id END,
          'playing', now(), '1v1',
          '["", "", "", "", "", "", "", "", ""]'::jsonb,
          true)
  RETURNING id INTO _match_id;

  RETURN _match_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_trophies(winner uuid, loser uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (winner, loser) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.matches
    WHERE status = 'finished'
      AND winner_id = winner
      AND is_friendly = false
      AND created_at >= now() - interval '1 day'
      AND (
        (player1_id = winner AND player2_id = loser)
        OR (player1_id = loser AND player2_id = winner)
        OR (player1_id = winner AND player3_id = loser)
        OR (player1_id = loser AND player3_id = winner)
        OR (player1_id = winner AND player4_id = loser)
        OR (player1_id = loser AND player4_id = winner)
        OR (player2_id = winner AND player3_id = loser)
        OR (player2_id = loser AND player3_id = winner)
        OR (player2_id = winner AND player4_id = loser)
        OR (player2_id = loser AND player4_id = winner)
        OR (player3_id = winner AND player4_id = loser)
        OR (player3_id = loser AND player4_id = winner)
      )
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'invalid match result';
  END IF;

  UPDATE public.profiles SET trophies = GREATEST(0, trophies + 30), games_won = games_won + 1 WHERE user_id = winner;
  UPDATE public.profiles SET trophies = GREATEST(0, trophies - 20), games_lost = games_lost + 1 WHERE user_id = loser;
END;
$function$;
