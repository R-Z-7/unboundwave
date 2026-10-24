# Install Unboundwave

Deploy the production build at the root of an HTTPS domain. The existing Express server and Docker build serve the PWA files; no separate native app package is needed. Run `npm run build` (including the cache-generation step), then `npm run server`. Localhost supports testing, but an ordinary HTTP LAN address does not provide the secure context needed for full PWA features. The normal Vite development server intentionally does not register a service worker.

## Devices

- **iPhone / iPad:** open the HTTPS link in Safari, choose Share → Add to Home Screen, and enable Open as Web App if offered.
- **Android:** use Install app inside Unboundwave when the browser offers it, or Chrome’s menu → Install app / Add to Home screen.
- **Windows / Linux / macOS:** use the install icon in Chrome or Edge. Supported Safari versions offer File → Add to Dock.
- **Other browsers:** use the website normally if installation is unavailable. Installation availability depends on the browser and device; a PWA does not guarantee support for every device.

Install instructions are available on the welcome page and in Settings → App on this device. The native install button appears only after the browser supplies an install prompt. See [browser install prompt behavior](https://web.dev/learn/pwa/installation-prompt).

## Offline and updates

Wait until app details say “Ready for offline use on this device” before disconnecting. The build generates a content-versioned cache containing HTML, JavaScript, CSS, manifest, and icons. Navigation and assets use the same cached release. APIs, sign-in callbacks, relay responses, and arbitrary URLs are never cached by the worker. Remote fonts may fall back to a system font offline.

You can reopen the app offline and unlock an identity already saved on that device to read locally saved private history. Private messages queue and retry while online with the app open and unlocked. Google sign-in, room discovery, and sending need a connection. Public room messages do not have an offline outbox. Browser storage can be cleared or evicted: export and keep your encrypted identity backup.

Updates install in the background and wait until every old app window and tab is closed. Settings shows when an update is ready. Finish any draft, close every Unboundwave tab and app window, then reopen. No forced reload interrupts an unlocked session. Old shell caches are removed when the new worker activates; encrypted browser storage is untouched. See [service worker lifecycle](https://web.dev/articles/service-worker-lifecycle).

Installing on another device does not migrate history, drafts, or queued messages. Import your encrypted identity backup there and unlock it with your recovery secret. Installation alone does not add automatic device synchronization.

## Acceptance checks

1. Run `npm test` and `npm run build`.
2. Serve `dist` with the Express server or `npm run preview`, visit online, and wait for offline readiness.
3. Reload with the browser offline. Confirm the welcome page, settings, and saved private history after unlocking work; API responses must never appear in Cache Storage.
4. Check 320px phone, tablet, desktop, landscape, and installed safe-area layouts. Check input focus with a real mobile keyboard.
5. Install on real iOS Safari and Android Chrome devices and a desktop browser. Check icon cropping, standalone launch, and returning from the background.
6. With a current app window open, deploy a changed build and check for updates. Confirm the current session stays intact; close all app windows and reopen to activate the new release.

Desktop browser emulation cannot certify real mobile installation, operating-system behavior, or keyboard behavior. Complete the physical-device checks against the deployed HTTPS origin before a public release.
