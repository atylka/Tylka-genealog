const VERSION='tylka-app-20261119-unified-header-titles-1';
const SHELL=['./','./index.html','./archive.html','./ancestors.html','./chronosearch.html','./location-registry.html','./styles.css?v=20261119-unified-header-titles-1','./supabase-config.js','./script.js?v=20261102-main-only-transition-1','./site-accessibility.js?v=20261102-a11y2','./site-ui.js?v=20261031-public-records','./thumbnail-tools.js?v=20261116-site-audit-cache-1','./coverage-map.js?v=20261119-coverage-home-1','./archive.js?v=20261118-readable-record-links-1','./ancestors.js?v=20261116-site-audit-cache-1','./chronosearch.js?v=20261119-chrono-no-card-description-1','./location-registry.js?v=20261116-site-audit-cache-1','./pwa-register.js?v=20261102-footer-placement-1','./icon.svg','./brand-seal.svg','./manifest.webmanifest'];
const EXTERNAL_SHELL=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  await cache.addAll(SHELL.map(path=>new URL(path,self.registration.scope).href));
  await Promise.allSettled(EXTERNAL_SHELL.map(async url=>{
   const response=await fetch(url,{mode:'cors'});
   if(response.ok)await cache.put(url,response);
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin){
  if(EXTERNAL_SHELL.includes(request.url)){
   event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok)caches.open(VERSION).then(cache=>cache.put(request,response.clone()));
    return response;
   })));
  }
  return;
 }
 if(url.pathname.includes('/rest/')||url.pathname.includes('/auth/')||url.pathname.includes('/storage/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(request);
   return cached||caches.match(new URL('./index.html',self.registration.scope));
  }));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}
  return response;
 })));
});