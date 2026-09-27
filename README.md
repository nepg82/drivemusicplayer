# Drive Music Player — setup

## 1. Create a Google OAuth Client ID
1. Go to https://console.cloud.google.com/ → create/select a project.
2. Enable the **Google Drive API** (APIs & Services → Library).
3. APIs & Services → Credentials → Create Credentials → OAuth client ID → type **Web application**.
4. Under "Authorized JavaScript origins" add wherever you'll run this, e.g.:
   - `http://localhost:8080` (for local testing)
   - `https://yourdomain.com` (for real hosting)
5. Copy the generated Client ID.

## 2. Configure the app
Open `index.html` and replace:
```js
const CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
```

## 3. Run it
Any static file server works — a service worker requires `https://` or `localhost`.
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open the printed `localhost` URL. Chrome/Edge will offer an "Install" icon in the
address bar once it loads — that's your PWA.

## Notes / limitations of this bare-bones version
- Only lists files whose MIME type contains `audio/`; nested folders aren't recursed.
- Playback loads the whole file into memory before playing (simplest approach) —
  fine for a prototype, but for large libraries you'd want the service-worker-proxy
  approach for range-request streaming instead.
- No offline caching of tracks yet — the service worker only caches the app shell.
- iOS Safari has limited background-audio support for PWAs; this works best on
  desktop and Android Chrome.
