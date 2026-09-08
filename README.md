# PoultryPro Farm Management

PoultryPro is a local-first poultry farm management app built with React and Vite. It covers daily tasks, flock health, inventory, farm finances, and operational reports.

## Run locally

```bash
npm install
npm run dev
```

For access from other devices on the same network, use `npm run dev:public` and share the host machine's LAN IP address. Run `npm run server` as well.

In a second terminal, start the farm API:

```bash
npm run server
```

## Hosting

The app is deployable as one Node service. The server serves the built React app and the API from the same origin, while PostgreSQL stores users and farm state.

### Railway deployment

The current Railway project is `poultrypro-edu-app` with an application service named `poultrypro` and a PostgreSQL service named `Postgres`. The live service is available at [poultrypro-production-3f7c.up.railway.app](https://poultrypro-production-3f7c.up.railway.app).

The app uses Railway's injected `PORT` value at runtime. `DATABASE_URL` is connected to the Postgres service, and `NODE_ENV=production` enables secure session cookies. To redeploy from this workspace:

```bash
railway up --service poultrypro
```

To inspect deployment status or logs:

```bash
railway status
railway logs --service poultrypro --lines 100
```

Render deployment is configured in [render.yaml](render.yaml): create a new Blueprint from this repository and Render will provision the web service and PostgreSQL database. The service runs `npm ci && npm run build` and starts with `npm start`.

For Docker-based hosting:

```bash
docker build -t poultrypro .
docker run --env DATABASE_URL="<postgres-connection-string>" -p 8787:8787 poultrypro
```

Set `DATABASE_URL` and `NODE_ENV=production` in the hosting provider. Set `CORS_ORIGIN` only when the frontend is hosted on a different domain; for the included single-service deployment, leave it empty. Production sessions are stored in the database, survive service restarts, and use secure HTTP-only cookies. Without `DATABASE_URL`, local development uses the JSON repository fallback.

### Render deployment

1. Push this repository to GitHub or another Git provider.
2. In Render, choose **New > Blueprint** and select the repository.
3. Confirm the `poultrypro` web service and `poultrypro-db` PostgreSQL database.
4. Deploy. Render injects `DATABASE_URL`; set `NODE_ENV=production` and leave `CORS_ORIGIN` empty for the single-service setup.
5. Open the generated `onrender.com` URL and test account creation, sign-in, farm updates, and sign-out.

PostgreSQL is the cloud storage for accounts and farm records. The JSON file under `server/data` is only a development fallback and should not be used as production storage because local container files can be replaced during redeploys.

Production checks:

```bash
npm run lint
npm run build
```

## Domain and storage

The farm domain lives in [src/domain/farm.js](src/domain/farm.js). It owns the farm entities and summary calculations. [src/storage/farmStorage.js](src/storage/farmStorage.js) is the persistence adapter.

The app supports account registration and sign-in. Sessions use an HTTP-only cookie, and each account receives its own farm state. The app hydrates from `GET /api/farm` and saves changes with `PUT /api/farm`. Users are stored in `server/data/users.json` and created farm data is isolated per user. If the API is unavailable, the browser falls back to `localStorage` under `poultrypro:farm:v1`.

The API is intentionally dependency-free for this phase. It supports multi-user sessions, but JSON files are not suitable for production scale. The next deployment step should replace them with a real database and add email verification, password reset, rate limiting, and HTTPS.
