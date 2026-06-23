const CACHE='health-radar-ai-v1-6-7';
const ASSETS=['./','./index.html','./styles.css','./app.js','./quick-fix.js','./firebase-cloud.js','./hotfix-161.js','./weather-card-fix-162.js','./hotfix-165.js','./hotfix-166.js','./manifest.json','./icon.svg','./hotfix-167-mobile.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));

self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
