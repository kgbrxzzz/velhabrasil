REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_trophies(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_trophies(uuid, uuid) TO authenticated;