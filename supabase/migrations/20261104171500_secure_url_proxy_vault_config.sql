create or replace function public.get_public_url_fetch_proxy_config()
returns table (proxy_url text, proxy_token text)
language sql
security definer
set search_path = ''
as $function$
  select
    (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'public_url_fetch_proxy_url'
      order by updated_at desc
      limit 1
    ),
    (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'public_url_fetch_proxy_token'
      order by updated_at desc
      limit 1
    );
$function$;

revoke all on function public.get_public_url_fetch_proxy_config() from public, anon, authenticated;
grant execute on function public.get_public_url_fetch_proxy_config() to service_role;
comment on function public.get_public_url_fetch_proxy_config() is
  'Returns the URL egress proxy configuration from Supabase Vault to the service-role-only Task Runner.';
