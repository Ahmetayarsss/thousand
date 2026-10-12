-- Oxford 3000 · Arkadaşlar — Supabase SQL Editor'de BİR KEZ çalıştırın (tekrar çalıştırmak da güvenli).
-- Tablolara doğrudan erişim kapalı (RLS açık, politika yok); uygulama yalnız aşağıdaki fonksiyonları çağırır.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nick          text not null check (char_length(nick) between 3 and 16),
  code          text not null unique,                 -- arkadaş kodu (6 harf/rakam)
  recovery_hash text not null unique,                 -- kurtarma kodunun özeti (kodun kendisi saklanmaz)
  stats         jsonb not null default '{}'::jsonb,   -- bugünkü ve toplam ilerleme özeti
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.friend_requests (
  from_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create table if not exists public.backups (
  user_id    uuid primary key references public.profiles(id) on delete cascade on update cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles        enable row level security;
alter table public.friendships     enable row level security;
alter table public.friend_requests enable row level security;
alter table public.backups         enable row level security;
revoke all on public.profiles, public.friendships, public.friend_requests, public.backups from anon, authenticated;

-- ---------- yardımcılar (dışarıya kapalı) ----------
create or replace function public._rand_code(n int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; b bytea := gen_random_bytes(n); i int;
begin
  for i in 0..n-1 loop s := s || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop;
  return s;
end $$;

create or replace function public._hash(p text) returns text
language sql stable set search_path = public, extensions as $$
  select encode(digest(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

create or replace function public._me() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giris_yok'; end if;
  if not exists (select 1 from profiles where id = uid) then raise exception 'profil_yok'; end if;
  return uid;
end $$;

create or replace function public._fmt(r text) returns text language sql immutable as $$
  select substr(r, 1, 4) || '-' || substr(r, 5, 4) || '-' || substr(r, 9, 4)
$$;

-- ---------- hesap ----------
-- İlk açılış: takma adla hesap. Dönen: {nick, code, recovery} (kurtarma kodu yalnız burada görünür).
create or replace function public.create_profile(p_nick text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); n text := btrim(coalesce(p_nick, '')); c text; r text; pr profiles;
begin
  if uid is null then raise exception 'giris_yok'; end if;
  select * into pr from profiles where id = uid;
  if found then return json_build_object('nick', pr.nick, 'code', pr.code, 'recovery', null); end if;
  if char_length(n) < 3 or char_length(n) > 16 then raise exception 'ad_uzunluk'; end if;
  loop c := _rand_code(6); exit when not exists (select 1 from profiles where code = c); end loop;
  r := _rand_code(12);
  insert into profiles (id, nick, code, recovery_hash) values (uid, n, c, _hash(r));
  return json_build_object('nick', n, 'code', c, 'recovery', _fmt(r));
end $$;

create or replace function public.set_nick(p_nick text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me(); n text := btrim(coalesce(p_nick, ''));
begin
  if char_length(n) < 3 or char_length(n) > 16 then raise exception 'ad_uzunluk'; end if;
  update profiles set nick = n where id = uid;
  return json_build_object('nick', n);
end $$;

-- Kurtarma kodu kaybolduysa (telefon hâlâ elde): yenisini üret, eskisi geçersiz olur.
create or replace function public.new_recovery() returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := _me(); r text := _rand_code(12);
begin
  update profiles set recovery_hash = _hash(r) where id = uid;
  return json_build_object('recovery', _fmt(r));
end $$;

-- Yeni telefonda: kurtarma koduyla eski hesabı bu girişe taşı (arkadaşlar ve yedek de gelir).
-- Bu telefonda yeni açılmış bir hesap varsa o silinir.
create or replace function public.claim_account(p_recovery text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); old profiles;
begin
  if uid is null then raise exception 'giris_yok'; end if;
  select * into old from profiles where recovery_hash = _hash(p_recovery);
  if not found then return json_build_object('ok', false); end if;
  if old.id = uid then return json_build_object('ok', true, 'nick', old.nick, 'code', old.code); end if;
  delete from profiles where id = uid;
  update profiles set id = uid, last_seen = now() where id = old.id;
  return json_build_object('ok', true, 'nick', old.nick, 'code', old.code);
end $$;

create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giris_yok'; end if;
  delete from profiles where id = uid;     -- arkadaşlıklar, istekler, yedek de silinir
  delete from auth.users where id = uid;
end $$;

-- ---------- ilerleme ----------
-- stats: {gun, cevap, dogru, yeni, dongu, olgun, seri}
create or replace function public.push_stats(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me();
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 2000 then raise exception 'gecersiz'; end if;
  update profiles set stats = p, last_seen = now() where id = uid;
end $$;

create or replace function public.push_backup(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me();
begin
  if p is null or pg_column_size(p) > 3000000 then raise exception 'gecersiz'; end if;
  insert into backups (user_id, data, updated_at) values (uid, p, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function public.get_backup() returns jsonb
language sql stable security definer set search_path = public as $$
  select data from backups where user_id = auth.uid()
$$;

-- ---------- arkadaşlık ----------
create or replace function public.send_request(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me(); t profiles;
begin
  select * into t from profiles where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then return json_build_object('ok', false, 'msg', 'kod_yok'); end if;
  if t.id = uid then return json_build_object('ok', false, 'msg', 'kendin'); end if;
  if exists (select 1 from friendships where user_id = uid and friend_id = t.id) then
    return json_build_object('ok', false, 'msg', 'zaten_arkadas', 'nick', t.nick); end if;
  if exists (select 1 from friend_requests where from_id = t.id and to_id = uid) then   -- o da istemiş: arkadaş olun
    delete from friend_requests where from_id = t.id and to_id = uid;
    insert into friendships (user_id, friend_id) values (uid, t.id), (t.id, uid) on conflict do nothing;
    return json_build_object('ok', true, 'msg', 'arkadas_oldunuz', 'nick', t.nick); end if;
  if (select count(*) from friend_requests where from_id = uid) >= 50 then
    return json_build_object('ok', false, 'msg', 'cok_istek'); end if;
  insert into friend_requests (from_id, to_id) values (uid, t.id) on conflict do nothing;
  return json_build_object('ok', true, 'msg', 'gonderildi', 'nick', t.nick);
end $$;

create or replace function public.respond_request(p_from uuid, p_accept boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me();
begin
  delete from friend_requests where from_id = p_from and to_id = uid;
  if not found then return false; end if;
  if p_accept then
    insert into friendships (user_id, friend_id) values (uid, p_from), (p_from, uid) on conflict do nothing;
  end if;
  return true;
end $$;

create or replace function public.cancel_request(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me();
begin
  delete from friend_requests where from_id = uid and to_id = p_to;
end $$;

create or replace function public.remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me();
begin
  delete from friendships where (user_id = uid and friend_id = p_friend) or (user_id = p_friend and friend_id = uid);
end $$;

-- Arkadaşlar sayfası tek çağrıda: ben, arkadaşlar (ilerlemeleriyle), gelen ve giden istekler.
create or replace function public.dashboard() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'me', (select json_build_object('id', p.id, 'nick', p.nick, 'code', p.code) from profiles p where p.id = auth.uid()),
    'friends', coalesce((select json_agg(json_build_object('id', p.id, 'nick', p.nick, 'stats', p.stats, 'last_seen', p.last_seen)
                                         order by p.last_seen desc)
                         from friendships f join profiles p on p.id = f.friend_id where f.user_id = auth.uid()), '[]'::json),
    'incoming', coalesce((select json_agg(json_build_object('id', p.id, 'nick', p.nick, 'code', p.code, 'at', r.created_at)
                                          order by r.created_at desc)
                          from friend_requests r join profiles p on p.id = r.from_id where r.to_id = auth.uid()), '[]'::json),
    'outgoing', coalesce((select json_agg(json_build_object('id', p.id, 'nick', p.nick, 'code', p.code, 'at', r.created_at)
                                          order by r.created_at desc)
                          from friend_requests r join profiles p on p.id = r.to_id where r.from_id = auth.uid()), '[]'::json)
  )
$$;

-- ---------- yetkiler: yalnız giriş yapmış kullanıcılar, yalnız bu fonksiyonlar ----------
revoke execute on function public._rand_code(int), public._hash(text), public._me(), public._fmt(text) from public, anon, authenticated;
revoke execute on function public.create_profile(text), public.set_nick(text), public.new_recovery(), public.claim_account(text),
  public.delete_account(), public.push_stats(jsonb), public.push_backup(jsonb), public.get_backup(), public.send_request(text),
  public.respond_request(uuid, boolean), public.cancel_request(uuid), public.remove_friend(uuid), public.dashboard() from public, anon;
grant execute on function public.create_profile(text), public.set_nick(text), public.new_recovery(), public.claim_account(text),
  public.delete_account(), public.push_stats(jsonb), public.push_backup(jsonb), public.get_backup(), public.send_request(text),
  public.respond_request(uuid, boolean), public.cancel_request(uuid), public.remove_friend(uuid), public.dashboard() to authenticated;
