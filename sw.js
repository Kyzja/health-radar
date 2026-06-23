const CACHE='health-radar-ai-v1-6-3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./quick-fix.js','./firebase-cloud.js','./hotfix-161.js','./weather-card-fix-162.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
