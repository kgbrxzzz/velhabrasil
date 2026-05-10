REVOKE ALL ON FUNCTION public.cleanup_stale_matchmaking_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_or_create_match_1v1(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_or_create_match_2v2(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_match_1v1(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_match_2v2(uuid, integer) TO authenticated;