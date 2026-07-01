/* 후쿠오카 길잡이 · 서비스워커 — 오프라인 캐시
   앱셸은 캐시-우선, Firebase SDK(gstatic)는 런타임 캐시,
   Firestore 데이터 통신(googleapis)은 가로채지 않고 SDK의 오프라인 캐시에 맡김. */
const CACHE = "fukuoka-v7";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(req) {
  return caches.match(req).then(hit => {
    if (hit) return hit;
    return fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;            // Firestore 쓰기 등은 그대로 통과
  const u = new URL(req.url);

  // Firestore / Firebase 실시간 통신은 가로채지 않음 (SDK가 오프라인 처리)
  if (/googleapis\.com|firebaseio\.com|firebaseinstallations|google-analytics|gstatic\.com\/firebasejs/.test(u.href)) {
    if (u.href.includes("gstatic.com/firebasejs")) { e.respondWith(cacheFirst(req)); }
    return;
  }
  // 그 외 gstatic 정적 자원
  if (u.hostname.includes("gstatic.com")) { e.respondWith(cacheFirst(req)); return; }
  // Leaflet 지도 라이브러리(unpkg)는 런타임 캐시 → 두 번째부터 빠르게
  if (u.hostname.includes("unpkg.com")) { e.respondWith(cacheFirst(req)); return; }
  // 지도 타일은 캐시하지 않고 통과(용량·변동성)
  if (u.hostname.includes("tile.openstreetmap.org")) { return; }

  // 같은 출처(앱셸): 캐시 우선, 오프라인 시 index로 폴백
  if (u.origin === self.location.origin) {
    e.respondWith(cacheFirst(req).catch(() => caches.match("./index.html")));
  }
});
