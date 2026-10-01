REVOKE ALL ON FUNCTION public.v2_est_invite(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.v2_est_proprietaire(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_est_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v2_est_proprietaire(uuid) TO authenticated;