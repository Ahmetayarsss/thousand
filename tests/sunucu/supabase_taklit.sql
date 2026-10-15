-- Supabase'in sağladığı parçaların test için taklidi (yalnız tests/sunucu.test.sh kullanır; Supabase'e
-- çalıştırılmaz). Gerçekte auth şeması, roller ve auth.uid() Supabase'den gelir.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users (id uuid primary key);
-- Supabase'te giriş yapan kullanıcının kimliği JWT'den okunur; testte oturum ayarından.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, extensions to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
