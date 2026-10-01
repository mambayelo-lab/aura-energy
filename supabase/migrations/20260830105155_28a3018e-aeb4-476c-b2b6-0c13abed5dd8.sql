revoke execute on function public.has_platform_access(uuid) from anon, authenticated;
grant execute on function public.has_platform_access(uuid) to service_role;