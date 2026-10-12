-- Oxford 3000 · Arkadaşlar, yedek, kullanım kayıtları, bildirimler — Supabase SQL Editor'de çalıştırın.
-- Tekrar çalıştırmak güvenli: tablolar ve veriler korunur, fonksiyonlar güncellenir. Dosya değişince
-- (yeni sürüm) tamamını yeniden çalıştırın.
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
-- Bu telefonda yeni açılmış bir hesap varsa o silinir. Eski telefonun bildirim anahtarı geçersiz olur
-- (bildirim_hash: aşağıda, bildirimler bölümünde); yeni telefon kendine yenisini alır.
create or replace function public.claim_account(p_recovery text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); old profiles;
begin
  if uid is null then raise exception 'giris_yok'; end if;
  select * into old from profiles where recovery_hash = _hash(p_recovery);
  if not found then return json_build_object('ok', false); end if;
  if old.id = uid then return json_build_object('ok', true, 'nick', old.nick, 'code', old.code); end if;
  delete from profiles where id = uid;
  update profiles set id = uid, last_seen = now(), bildirim_hash = null where id = old.id;
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

-- ================= kullanım kayıtları (geliştirici için) =================
-- Uygulamanın olay günlüğü (log.js) hesabı olan telefonlardan buraya gelir. Bakmak için:
-- Table Editor → kayitlar_gorunum (en yeni üstte, Türkiye saati) ya da SQL Editor'de
--   select * from kayitlar_gorunum limit 200;
-- Kişi başı 24 saatte en çok ~5000 olay alınır; 60 günden eski kayıtlar her gönderimde azar azar silinir.
create table if not exists public.kayitlar (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  t          timestamptz not null,                  -- olay zamanı (telefon saati)
  tur        text not null,                         -- olay türü: sayfa, cevap, hata, …
  veri       jsonb,                                 -- olay ayrıntısı
  surum      bigint,                                -- web sürümü (web-version.txt)
  created_at timestamptz not null default now()     -- sunucuya geldiği an
);
create index if not exists kayitlar_user_created_idx on public.kayitlar (user_id, created_at);
create index if not exists kayitlar_created_idx on public.kayitlar (created_at);

-- Telefon başına bir satır: cihaz bilgisi ve alınan son olayın sıra numarası (log.js her olaya sıra verir).
-- Cevabı kaybolan bir gönderim tekrarlanırsa aynı olaylar ikinci kez yazılmaz.
create table if not exists public.kayit_cihaz (
  user_id    uuid not null references public.profiles(id) on delete cascade on update cascade,
  kimlik     text not null,                         -- log.js'teki rastgele cihaz kimliği
  cihaz      text,                                  -- tarayıcı/WebView bilgisi (user agent)
  surum      bigint,
  son_sira   bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kimlik)
);

alter table public.kayitlar    enable row level security;
alter table public.kayit_cihaz enable row level security;
revoke all on public.kayitlar, public.kayit_cihaz from anon, authenticated;
revoke all on sequence public.kayitlar_id_seq from anon, authenticated;

-- p: {kimlik, sira, toplam, surum, cihaz, olaylar: [[ms, tür, veri?], …]}
--   sira: ilk olayın sıra numarası, toplam: telefondaki son sıra. En çok 500 olay / 256 KB.
-- Biçimi bozuk olay atlanır, büyük veri kısaltılır. Dönen: yazılan olay sayısı (daha önce alınanlar
-- ve 24 saatlik sınırı aşanlar sessizce atlanır; telefon bunları tekrar göndermez).
create or replace function public.push_logs(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := _me(); ev jsonb := p -> 'olaylar'; n int; kim text; x numeric; s0 bigint; top bigint; sv bigint;
  son bigint; atla int := 0; hak int; yazilan int;
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 262144 then raise exception 'gecersiz'; end if;
  if ev is null or jsonb_typeof(ev) <> 'array' then raise exception 'gecersiz'; end if;
  n := jsonb_array_length(ev);
  if n > 500 then raise exception 'gecersiz'; end if;
  kim := coalesce(nullif(left(p ->> 'kimlik', 40), ''), '?');
  x := case when jsonb_typeof(p -> 'sira') = 'number' then (p ->> 'sira')::numeric end;     s0 := case when x between 1 and 1e15 then x end;
  x := case when jsonb_typeof(p -> 'toplam') = 'number' then (p ->> 'toplam')::numeric end; top := case when x between 0 and 1e15 then x end;
  x := case when jsonb_typeof(p -> 'surum') = 'number' then (p ->> 'surum')::numeric end;   sv := case when x between 0 and 1e15 then x end;

  -- cihaz satırı (yoksa açılır) kilitlenir: aynı telefondan eşzamanlı iki gönderim sırayla işlenir
  insert into kayit_cihaz (user_id, kimlik) values (uid, kim) on conflict do nothing;
  select son_sira into son from kayit_cihaz where user_id = uid and kimlik = kim for update;
  if s0 is not null then
    if top is not null and top < son then son := 0; end if;      -- telefondaki sayaç sıfırlanmış: baştan say
    atla := greatest(0, least(n, son - s0 + 1));                 -- partinin başındaki bu kadar olay zaten alınmış
    son := greatest(son, s0 + n - 1);
  end if;
  update kayit_cihaz set son_sira = son, cihaz = coalesce(left(p ->> 'cihaz', 300), cihaz), surum = coalesce(sv, surum),
    updated_at = now() where user_id = uid and kimlik = kim;

  -- 24 saatte en çok 5000 olay
  select greatest(0, 5000 - count(*)) into hak from kayitlar where user_id = uid and created_at > now() - interval '24 hours';
  insert into kayitlar (user_id, t, tur, veri, surum)
  select uid, to_timestamp((e ->> 0)::float8 / 1000), e ->> 1,
         case when jsonb_typeof(e -> 2) is null or jsonb_typeof(e -> 2) = 'null' then null
              when pg_column_size(e -> 2) > 8192 then jsonb_build_object('kesik', pg_column_size(e -> 2))
              else e -> 2 end, sv
  from (select j.e, j.i from jsonb_array_elements(ev) with ordinality as j(e, i)
        where j.i > atla and case when jsonb_typeof(j.e) <> 'array' then false
                                  when jsonb_array_length(j.e) not between 2 and 3 then false
                                  when jsonb_typeof(j.e -> 0) <> 'number' or jsonb_typeof(j.e -> 1) <> 'string' then false
                                  when (j.e ->> 0)::numeric not between 946684800000 and 4102444800000 then false
                                  else char_length(j.e ->> 1) between 1 and 40 end
        order by j.i limit hak) o;
  get diagnostics yazilan = row_count;

  -- saklama: 60 günden eski kayıtlar (her çağrıda en çok 1000 satır; ücretsiz veritabanı dolmasın)
  delete from kayitlar where id in
    (select id from kayitlar where created_at < now() - interval '60 days' order by created_at limit 1000);
  return yazilan;
end $$;

-- Geliştiricinin bakacağı görünüm (Supabase panelinde postgres olarak görünür; uygulamadan erişilemez).
create or replace view public.kayitlar_gorunum with (security_invoker = true) as
  select date_trunc('second', k.t at time zone 'Europe/Istanbul') as zaman, p.nick, p.code as kod, k.tur, k.veri, k.surum,
         date_trunc('second', k.created_at at time zone 'Europe/Istanbul') as alindi, k.user_id, k.id
  from public.kayitlar k join public.profiles p on p.id = k.user_id
  order by k.t desc, k.id desc;
revoke all on public.kayitlar_gorunum from anon, authenticated;

revoke execute on function public.push_logs(jsonb) from public, anon;
grant execute on function public.push_logs(jsonb) to authenticated;

-- ================= bildirimler (uygulama kapalıyken arkadaşlık isteği) =================
-- Telefon arka planda (~15 dk'da bir) bildirim_kontrol'ü çağırır. Oturum (JWT) uygulamanın içinde kalır;
-- arka plan için hesaba özel ayrı bir bildirim anahtarı kullanılır, sunucuda yalnız özeti (sha256) durur.
alter table public.profiles add column if not exists bildirim_hash text;
create unique index if not exists profiles_bildirim_hash_key on public.profiles (bildirim_hash);

-- Yeni anahtar (200 bit) üret; eskisi geçersiz olur. Dönen: {anahtar} (yalnız burada görünür).
create or replace function public.bildirim_anahtari() returns json
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := _me(); s text := _rand_code(40);
begin
  update profiles set bildirim_hash = _hash(s) where id = uid;
  return json_build_object('anahtar', s);
end $$;

-- Arka plan kontrolü (giriş gerekmez, anahtar yeter): p_sonra'dan sonra gelen istekler (en yeni önce,
-- en çok 5) ve bekleyen istek sayısı. Anahtar bilinmiyorsa {ok:false} (telefon kontrolü bırakır).
create or replace function public.bildirim_kontrol(p_anahtar text, p_sonra timestamptz default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  if p_anahtar is null or char_length(p_anahtar) not between 20 and 100 then return json_build_object('ok', false); end if;
  select id into uid from profiles where bildirim_hash = _hash(p_anahtar);
  if uid is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true,
    'yeni', coalesce((select json_agg(json_build_object('nick', x.nick, 'at', x.created_at) order by x.created_at desc)
                      from (select p.nick, r.created_at from friend_requests r join profiles p on p.id = r.from_id
                            where r.to_id = uid and (p_sonra is null or r.created_at > p_sonra)
                            order by r.created_at desc limit 5) x), '[]'::json),
    'bekleyen', (select count(*) from friend_requests where to_id = uid));
end $$;

revoke execute on function public.bildirim_anahtari(), public.bildirim_kontrol(text, timestamptz) from public, anon;
grant execute on function public.bildirim_anahtari() to authenticated;
grant execute on function public.bildirim_kontrol(text, timestamptz) to anon, authenticated;
