REVOKE EXECUTE ON FUNCTION public.has_platform_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_confidential(uuid, public.confidentiality_level) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_mission_member(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_platform_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_confidential(uuid, public.confidentiality_level) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_mission_member(uuid) TO authenticated, service_role;