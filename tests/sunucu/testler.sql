-- supabase/kurulum.sql işlevlerinin testleri. tests/sunucu.test.sh çalıştırır (geçici veritabanında).
-- Her denetim "ok - …" yazar; tutmayan denetim hata verip testi durdurur.
\set ON_ERROR_STOP 1
\o /dev/null
create schema test;
create function test.ok(k boolean, ad text) returns void language plpgsql as $$
begin
  if not coalesce(k, false) then raise exception 'HATA - %', ad; end if;
  raise notice 'ok - %', ad;
end $$;
grant usage on schema test to anon, authenticated;
grant execute on function test.ok(boolean, text) to anon, authenticated;

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'
insert into auth.users values (:'A'), (:'B'), (:'C');

-- ---------- erişim: tablolar kapalı, işlevler yalnız giriş yapmışa ----------
set role anon;
do $$ begin perform public.create_profile('Ahmet'); raise exception 'HATA - girişsiz create_profile çalıştı';
exception when insufficient_privilege then raise notice 'ok - girişsiz (anon) hesap açamaz'; end $$;
do $$ begin perform * from public.profiles; raise exception 'HATA - anon tabloyu okudu';
exception when insufficient_privilege then raise notice 'ok - anon tabloları okuyamaz'; end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
do $$ begin perform * from public.backups; raise exception 'HATA - kullanıcı yedek tablosunu doğrudan okudu';
exception when insufficient_privilege then raise notice 'ok - giriş yapmış kullanıcı da tabloları doğrudan okuyamaz'; end $$;
do $$ begin perform public._hash('x'); raise exception 'HATA - yardımcı işlev dışarı açık';
exception when insufficient_privilege then raise notice 'ok - yardımcı işlevler (_hash, _me…) dışarıya kapalı'; end $$;
do $$ begin perform public.push_stats('{}'); raise exception 'HATA - profilsiz push_stats çalıştı';
exception when raise_exception then raise notice 'ok - profili olmayan işlem yapamaz (profil_yok)'; end $$;

-- ---------- hesap ----------
do $$ begin perform public.create_profile('ab'); raise exception 'HATA - 2 harfli ad kabul edildi';
exception when raise_exception then raise notice 'ok - takma ad 3–16 harf (ad_uzunluk)'; end $$;
select (r->>'code') as a_kod, (r->>'recovery') as a_kurtarma from (select public.create_profile('  Ahmet  ') r) x \gset
select test.ok(:'a_kod' ~ '^[A-Z2-9]{6}$', 'hesap açılır: 6 haneli arkadaş kodu');
select test.ok(:'a_kurtarma' ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$', 'kurtarma kodu XXXX-XXXX-XXXX biçiminde, yalnız açılışta görünür');
select test.ok((public.create_profile('Baska')->>'recovery') is null and (public.create_profile('Baska')->>'code') = :'a_kod',
  'ikinci create_profile aynı hesabı döner, kurtarma kodunu tekrar göstermez');
select test.ok((public.set_nick('Ahmo')->>'nick') = 'Ahmo', 'takma ad değişir');

select set_config('request.jwt.claim.sub', :'B', false);
select (public.create_profile('Busra')->>'code') as b_kod \gset
select set_config('request.jwt.claim.sub', :'A', false);

-- ---------- yedek ----------
select public.push_backup('{"v":1,"keys":{"ox3000_srs_v1":{"1|apple":{"b":3}}}}');
select test.ok(public.get_backup() #>> '{keys,ox3000_srs_v1,1|apple,b}' = '3', 'yedek yazılır ve geri okunur');
select set_config('request.jwt.claim.sub', :'B', false);
select test.ok(public.get_backup() is null, 'başkasının yedeği okunamaz');
select set_config('request.jwt.claim.sub', :'A', false);
do $$ begin perform public.push_backup(jsonb_build_object('x', repeat('a', 3100000))); raise exception 'HATA - 3 MB üstü yedek kabul edildi';
exception when raise_exception then raise notice 'ok - yedek boyutu sınırlı (3 MB)'; end $$;
do $$ begin perform public.push_stats(jsonb_build_object('x', repeat('a', 3000))); raise exception 'HATA - büyük özet kabul edildi';
exception when raise_exception then raise notice 'ok - ilerleme özeti boyutu sınırlı'; end $$;
select public.push_stats('{"gun":20370,"cevap":12,"dongu":40,"olgun":5,"seri":3}');

-- ---------- arkadaşlık ----------
select test.ok((public.send_request(:'a_kod')->>'msg') = 'kendin', 'kendine istek gönderilemez');
select test.ok((public.send_request('XXXXXX')->>'msg') = 'kod_yok', 'olmayan kod: kod_yok');
select test.ok((public.send_request(lower(:'b_kod'))->>'msg') = 'gonderildi', 'istek gönderilir (küçük harfli kod da olur)');
select set_config('request.jwt.claim.sub', :'B', false);
select test.ok(json_array_length(public.dashboard()->'incoming') = 1, 'karşı taraf gelen isteği görür');
select test.ok(public.respond_request(:'A', true), 'istek kabul edilir');
select test.ok(json_array_length(public.dashboard()->'friends') = 1
  and (public.dashboard()#>>'{friends,0,stats,cevap}') = '12', 'arkadaş listede, ilerleme özetiyle');
select test.ok(not public.respond_request(:'A', true), 'olmayan isteğe cevap: false');

-- ---------- dürtme ----------
select test.ok((public.durt(:'C')->>'msg') = 'arkadas_degil', 'arkadaş olmayan dürtülemez');
select test.ok((public.durt(:'A')->>'msg') = 'gonderildi', 'arkadaş dürtülür');
select test.ok((public.durt(:'A')->>'msg') = 'bugun_durttun', 'aynı gün ikinci kez dürtülemez');
select set_config('request.jwt.claim.sub', :'A', false);
select test.ok(json_array_length(public.dashboard()->'durtmeler') = 1, 'dürtülen, dürtmeyi panoda görür');

-- ---------- bildirim kontrolü (arka plan, girişsiz) ----------
select (public.bildirim_anahtari()->>'anahtar') as a_anahtar \gset
select set_config('request.jwt.claim.sub', :'C', false);
select public.create_profile('Cem');
select public.send_request(:'a_kod');
reset role;
set role anon;
select test.ok((public.bildirim_kontrol(:'a_anahtar')->>'bekleyen')::int = 1
  and (public.bildirim_kontrol(:'a_anahtar')#>>'{yeni,0,nick}') = 'Cem'
  and json_array_length(public.bildirim_kontrol(:'a_anahtar')->'durt') = 1, 'bildirim kontrolü anahtarla: yeni istek ve dürtme');
select test.ok((public.bildirim_kontrol('YANLIS-ANAHTAR-0123456789')->>'ok') = 'false', 'yanlış anahtar: ok false, veri yok');
select test.ok((public.bildirim_kontrol(:'a_anahtar', now() + interval '1 minute')->>'yeni') = '[]', 'imleçten sonra yeni yoksa boş');
reset role;

-- ---------- kullanım kayıtları ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select test.ok(public.push_logs('{"kimlik":"tel1","sira":1,"toplam":3,"surum":5,"olaylar":[[1760000000000,"sayfa",{"p":"index"}],[1760000001000,"cevap"],["bozuk"]]}') = 2,
  'kayıtlar yazılır, bozuk olay atlanır');
-- 2. gönderim 3. olaydan başlar (3. olay ilk gönderimde de vardı: bozuk olan da sıra numarası alır)
select test.ok(public.push_logs('{"kimlik":"tel1","sira":3,"toplam":4,"olaylar":[[1760000001500,"tekrar"],[1760000002000,"hata"]]}') = 1,
  'aynı olay ikinci kez gelirse (cevap kaybolup tekrar gönderilince) yazılmaz');
do $$ begin perform public.push_logs(jsonb_build_object('kimlik','t','olaylar',(select jsonb_agg(jsonb_build_array(1760000000000,'x')) from generate_series(1,501))));
  raise exception 'HATA - 500 üstü olay kabul edildi';
exception when raise_exception then raise notice 'ok - tek gönderimde en çok 500 olay'; end $$;
reset role;
select test.ok((select count(*) from public.kayitlar where user_id = :'A') = 3, 'sunucuda A için 3 kayıt var');
set role authenticated;

-- ---------- kurtarma koduyla hesap taşıma ----------
select set_config('request.jwt.claim.sub', :'C', false);
select test.ok((public.claim_account('AAAA-BBBB-CCCC')->>'ok') = 'false', 'yanlış kurtarma kodu: ok false');
select test.ok((public.claim_account(lower(:'a_kurtarma'))->>'code') = :'a_kod', 'kurtarma koduyla hesap yeni girişe taşınır (küçük harf de olur)');
select test.ok((public.get_backup() #>> '{keys,ox3000_srs_v1,1|apple,b}') = '3', 'taşınan hesapta yedek de gelir');
select test.ok(json_array_length(public.dashboard()->'friends') = 1, 'taşınan hesapta arkadaşlar da gelir');
reset role;
set role anon;
select test.ok((public.bildirim_kontrol(:'a_anahtar')->>'ok') = 'false', 'taşınınca eski telefonun bildirim anahtarı geçersiz');
reset role;
select test.ok(not exists (select 1 from public.profiles where id = :'A'), 'eski girişte profil kalmaz');

-- ---------- hesabı silme ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'C', false);
select public.delete_account();
reset role;
select test.ok(not exists (select 1 from public.profiles where id = :'C')
  and not exists (select 1 from public.backups where user_id = :'C')
  and not exists (select 1 from public.kayitlar where user_id = :'C')
  and not exists (select 1 from public.friendships where user_id = :'C' or friend_id = :'C')
  and not exists (select 1 from auth.users where id = :'C'), 'hesap silinince yedek, kayıtlar, arkadaşlıklar ve giriş de silinir');
