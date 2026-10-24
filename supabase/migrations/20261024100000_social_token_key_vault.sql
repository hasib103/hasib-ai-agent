-- Keep the AES-GCM token encryption key in Supabase Vault instead of requiring
-- an additional manually configured Edge Function environment secret.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'social_token_encryption_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'social_token_encryption_key', 'AES-GCM key for social provider token encryption');
  end if;
end $$;

create or replace function public.get_social_token_encryption_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'social_token_encryption_key'
  limit 1;
$$;
revoke all on function public.get_social_token_encryption_key() from public, anon, authenticated;
grant execute on function public.get_social_token_encryption_key() to service_role;
