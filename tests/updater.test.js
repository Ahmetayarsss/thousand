// Güncelleyici (templates/updater.js) davranış testi: sahte Capacitor ortamında release'ten indirme.
// Çalıştır: node tests/updater.test.js
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','templates','updater.js'),'utf8').replace('__WEBVER__','100');
async function run(name, remote, expect){
  const ls={}, written={}, urls=[]; let replaced=null;
  const resp=(u)=>remote[u.split('/').pop()];
  const ctx={
    localStorage:{getItem:k=>k in ls?ls[k]:null,setItem:(k,v)=>ls[k]=String(v),removeItem:k=>delete ls[k]},
    location:{href:'http://localhost/index.html',pathname:'/index.html',search:'',hash:'',replace:u=>replaced=u},
    document:{readyState:'complete'},
    fetch:async(u)=>{urls.push(u);const r=resp(u);return r==null?{ok:false,status:404,text:async()=>'Not Found'}:{ok:true,status:200,text:async()=>r};},
    setTimeout:(f)=>Promise.resolve().then(f), addEventListener(){}, console, JSON, Promise, Object, String, parseInt, atob,
  };
  ctx.window=ctx;
  ctx.Capacitor={isNativePlatform:()=>true,convertFileSrc:u=>u.replace('file://','http://localhost/_capacitor_file_'),Plugins:{
    Filesystem:{readdir:async()=>({files:[]}),rmdir:async()=>{},writeFile:async(o)=>{written[o.path]=o.data},getUri:async(o)=>({uri:'file:///data/'+o.path})},
    CapacitorHttp:{request:async({url})=>{urls.push('H:'+url);const r=resp(url);return r==null?{status:404,data:'Not Found'}:{status:200,data:r}}}}};
  vm.runInNewContext(src, ctx);
  for(let i=0;i<20;i++) await new Promise(r=>setImmediate(r));
  const got={applied: ls.ox_webupd?JSON.parse(ls.ox_webupd).ver:0, files:Object.keys(written).length, replaced:!!replaced,
             onlyRelease: urls.every(u=>u.replace('H:','').startsWith('https://github.com/Ahmetayarsss/thousand/releases/download/apk-latest/'))};
  const ok=Object.entries(expect).every(([k,v])=>got[k]===v);
  console.log((ok?'ok':'HATA')+' - '+name, ok?'':JSON.stringify(got));
  if(!ok) process.exitCode=1;
}
(async()=>{
  const pkt=JSON.stringify({'index.html':'<html>yeni</html>','updater.js':'var VER = 200;'});
  await run('yeni sürüm release\'te → indirilir, uygulanır', {'web-version.txt':'200','web.json':pkt}, {applied:200,files:2,replaced:true,onlyRelease:true});
  await run('aynı sürüm → hiçbir şey yapılmaz', {'web-version.txt':'100','web.json':pkt}, {applied:0,files:0,replaced:false});
  await run('release yok (404) → hiçbir şey yapılmaz', {}, {applied:0,files:0,replaced:false,onlyRelease:true});
  await run('paket 404 → uygulanmaz', {'web-version.txt':'200'}, {applied:0,files:0,replaced:false});
  await run('paket bozuk (index.html yok) → uygulanmaz', {'web-version.txt':'200','web.json':'{"a":1}'}, {applied:0,files:0,replaced:false});
  await run('paketin sürümü farklı (yükleme yarışı) → uygulanmaz', {'web-version.txt':'300','web.json':pkt}, {applied:0,files:0,replaced:false});
  await run('sürüm dosyası çöp → uygulanmaz', {'web-version.txt':'<html>404</html>','web.json':pkt}, {applied:0,files:0,replaced:false});
})();
