// 성과면담 노트: 인터넷이 없어도 화면이 열리도록 앱 파일만 저장 (면담 내용은 저장하지 않음)
const CACHE = 'perf-review-v2';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'vendor/supabase.js', 'vendor/docx.js', 'assets/wavenet-logo-white.png', 'icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./'))));
});
