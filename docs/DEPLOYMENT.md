# Deployment options

Unboundwave consists of a Vite frontend and an Express backend. The backend serves the built frontend, so one Docker service can host both. The server accepts PORT (defaults to 3001). Its encrypted backup files need persistent storage; its current in-memory session store must be replaced for reliable production account access.

## Render — simplest current architecture
Create a Docker Web Service from the GitHub repository. Attach a persistent disk at `/app/data`, set DATA_DIR=/app/data, and let the Dockerfile build/start the app. Render persistent disks require a paid eligible service. Configure APP_ORIGIN to the HTTPS public origin; provide SESSION_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET privately in service settings. Register APP_ORIGIN/api/auth/callback with Google. Replace the session store before public production use. See https://render.com/docs/docker and https://render.com/docs/disks.

## Railway — Docker plus a volume
Deploy the GitHub repository using its Dockerfile. Generate a public domain; attach a volume at `/app/data`. Configure DATA_DIR and the same secrets/origin/callback as above. The platform's PORT environment value is supported. Replace the session store before production. See https://docs.railway.com/guides/docker-compose and https://docs.railway.com/volumes.

## VPS — more control, more maintenance
Run the supplied Docker Compose setup behind an HTTPS reverse proxy such as Caddy or nginx. Back up the persistent data directory, set a canonical APP_ORIGIN, configure Google OAuth, and restrict direct backend exposure. Manage updates, monitoring, disk backups and session-store persistence yourself. See SELF_HOSTING.md.

## Vercel — requires adaptation for the full app
The Vite frontend can be served as a static build, and Vercel supports Express as a Function. This project's local file-backed backups and in-memory sessions require external durable storage/session persistence before using that backend architecture. A frontend-only deployment does not provide the Google account/backup backend; retain independent identity mode or connect an adapted backend. See https://vercel.com/docs/frameworks/backend/express.

GitHub Pages alone is suitable for a static preview, not the full Google-authenticated backend. This repository does not currently contain Pages base-path/routing configuration.

No hosting account, paid plan or live deployment has been created. This development release still has unfinished features listed in README.md.
