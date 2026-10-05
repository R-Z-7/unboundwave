# Unboundwave
**Your voice. Your network.**

An MIT-licensed React/TypeScript Nostr chat client and a minimal optional Google account backend. The default view is a clearly labelled illustrative preview; it never pretends to send messages. This is a working development release, **not a completed or security-audited first release**.

## Run locally
Requires Node 22.12+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
# In another terminal:
node --env-file=.env server/index.mjs
```
Open http://localhost:5173. For independent messaging, click your profile, choose a display name and a separate recovery secret (16+ characters), and create an identity. Export the encrypted backup in Settings. A fresh browser needs both that backup and its recovery secret; an existing Nostr nsec can also be imported. Never share the nsec.

For Google: create a Google Web OAuth client, add `http://localhost:5173/api/auth/callback` as its authorized redirect URI, and set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Restart the backend. Google uses OpenID Connect, PKCE S256, state, nonce, verified ID token claims, and an HttpOnly SameSite session. Only the `openid` scope is requested, so email is neither requested nor published. Callback tokens stay server-side and are not stored. Google sign-in opens identity onboarding: it cannot decrypt a backup without the independent secret. The account backend syncs only display names and encrypted backups.

## Test real messaging
Use two separate browser profiles. Create/unlock two independent identities (or sign into separately configured Google accounts and create/unlock identities). Share each public identity through Invite a friend. Add the friend's npub with New conversation. Wait for inbox announcements to be accepted on reachable relays. Send a message. On the second browser unlock the recipient identity. It should decrypt a kind-1059 NIP-59 envelope into a kind-14 message. The UI shows **accepted by relay**, never delivered/read. Check Settings for relay connectivity. Retry failed messages after fixing connectivity or inbox configuration. Outbox messages queue while offline and retry while the app is active and unlocked; no background delivery promise.

```sh
npm test
# Authentication tests bind an ephemeral local port.
npm run build
npm run preview
```
The PWA service worker is enabled only in production/preview. Load conversations online, then test offline using a production build. History and outbox are encrypted before browser storage; the application shell is cached. The identity backup is also encrypted. Messaging private keys exist only in unlocked page memory; a reload locks the identity. Browser extensions/XSS/device compromise can expose an unlocked identity. Clearing local history does not delete relay or recipient copies.

## Architecture
- Vite / React / TypeScript: responsive dark/light chat UI, room discovery, settings, profile links/QRs.
- nostr-tools: on-device secp256k1 identity generation, NIP-44 encryption and NIP-59 wrappers for NIP-17 direct messages. Recipient inboxes come from newest kind-10050 announcements; missing inbox means failure. Separate sender/recipient wraps, signature verification, rumor/seal author checking, reply tags, event IDs for duplicate prevention, explicit statuses and retry.
- Web Crypto: AES-256-GCM backups and history; PBKDF2-SHA256 with random salt and 600,000 iterations for recovery-secret protection. Never derived from Google claims, email, or tokens.
- Express / openid-client: Google account access, encrypted backup persistence, rate-limited API; no plaintext messages/private messaging keys.
- Nostr relays: independent default operators, configurable connections and reconnect probes. Operators may reject gift wraps or require NIP-42 AUTH (not yet implemented).

## Public rooms
NIP-29 is relay managed, not end-to-end encrypted. Discovery reads NIP-11 relay authority and queries signed kind-39000 from that authority (CORS and published authority required); join/leave send 9021/9022; room creation requests use 9007 and chat messages kind 9. Relay support and policy control acceptance. An accepted creation request is not proof of a created room. Generic default relays may have no NIP-29 support. **Timeline references, role discovery, and moderator controls need completion before interoperable production room support.** Curated cards are clearly labelled previews. Only rooms explicitly marked public by the advertised relay authority appear.

## Incomplete release work
- Google two-account live acceptance test needs operator credentials; no credentials included. Independent encryption and recovery are unit tested, but public-relay end-to-end delivery has not been asserted automatically.
- NIP-42 relay AUTH, recipient inbox refresh/change handling and reconnect subscription coverage.
- Encrypted reactions, optional explicit read acknowledgements, comprehensive spam controls, robust accepted-contact request gating.
- Production session store (current Express MemoryStore is development only), profile/avatar publishing, account settings sync status.
- NIP-29 moderator roles/controls, enforceable expiring invitations. Profile invitations do not expire.
- Public room messages need an offline outbox; currently private DMs queue offline. Draft text is not persisted until Send.
- PWA mobile install compatibility and real multi-device/offline acceptance tests. Recovery rotates neither keys nor historical encryption; lost secret+key means loss of access.

Google sees sign-in activity; the app backend knows the Google subject and account settings. Relays see connection IPs, recipient routing, timing and public room content. Google Fonts loads remote font resources. The app is neither anonymous nor entirely serverless. NIP-17 does not provide automatic forward secrecy; key compromise may expose retained history.

## Name review
Before implementation, checked current [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md), [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md), and [nostr-tools](https://github.com/nbd-wtf/nostr-tools). An existing **UnboundChat: Private AI (BYOK)** app is listed on [Google Play](https://play.google.com/store/apps/details?id=com.marko.unboundchat). This creates a related chat branding conflict. The project was renamed from Unbound to **Unboundwave** at the owner’s request. The earlier name search is not trademark clearance for the new name.

See [self hosting](docs/SELF_HOSTING.md), [roadmap](ROADMAP.md), [contributing](CONTRIBUTING.md), and [security policy](SECURITY.md).

See [deployment options](docs/DEPLOYMENT.md) for Render, Railway, VPS, and Vercel considerations.
