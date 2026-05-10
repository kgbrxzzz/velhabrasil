CREATE OR REPLACE FUNCTION public.update_trophies(winner uuid, loser uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (winner, loser) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.matches
    WHERE status = 'finished'
      AND winner_id = winner
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
$$;

REVOKE ALL ON FUNCTION public.update_trophies(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_trophies(uuid, uuid) TO authenticated;