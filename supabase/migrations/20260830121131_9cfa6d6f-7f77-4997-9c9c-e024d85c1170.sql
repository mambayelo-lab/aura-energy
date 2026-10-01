revoke execute on function public.is_org_member(uuid) from anon, public;
revoke execute on function public.is_org_admin(uuid) from anon, public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;