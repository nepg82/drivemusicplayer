const CACHE = "drive-music-shell-v2.0.3";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Ask the page for a fresh access token (the page handles refresh)
async function askToken(clientId) {
  let client = clientId && (await self.clients.get(clientId));
  if (!client) client = (await self.clients.matchAll({ type: "window" }))[0];
  if (!client) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => resolve(e.data);
    client.postMessage({ type: "need-token" }, [ch.port2]);
  });
}

// Drive's Content-Range header isn't readable cross-origin, so we rebuild it from the file size
const sizes = new Map();
async function fileSize(id, token) {
  if (sizes.has(id)) return sizes.get(id);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const size = r.ok ? Number((await r.json()).size) : NaN;
  if (size) sizes.set(id, size);
  return size;
}

// Proxy /drive-stream/<fileId> to Drive, adding auth and forwarding Range requests
async function stream(e, id, type) {
  const token = await askToken(e.clientId);
  if (!token) return new Response("No token", { status: 401 });
  const headers = { Authorization: `Bearer ${token}` };
  const range = e.request.headers.get("Range");
  if (range) headers.Range = range;
  const r0 = fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers });
  const [r, total] = await Promise.all([r0, fileSize(id, token)]);
  const out = new Headers({ "Content-Type": type, "Accept-Ranges": "bytes" });
  const len = r.headers.get("Content-Length");
  if (len) out.set("Content-Length", len);
  if (r.status === 206) {
    const start = Number(/bytes=(\d+)-/.exec(range || "")?.[1] ?? 0);
    const cr = r.headers.get("Content-Range") || (total && len ? `bytes ${start}-${start + Number(len) - 1}/${total}` : null);
    if (cr) out.set("Content-Range", cr);
  }
  return new Response(r.body, { status: r.status, headers: out });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const m = url.pathname.match(/\/drive-stream\/([\w-]+)$/);
  if (m) return e.respondWith(stream(e, m[1], url.searchParams.get("type") || "audio/mpeg"));
  // Network-first for the app shell (so edits show up), cache as offline fallback
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});