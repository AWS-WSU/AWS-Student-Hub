# Database setup

The backend uses MongoDB through Mongoose. The primary connection value is `MONGODB_URI` in `backend/.env`.

## Required backend variables

```env
MONGODB_URI=your-mongodb-connection-string
PORT=5001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
JWT_SECRET=your-jwt-secret
```

The frontend only needs to know where the backend API is running:

```env
VITE_API_URL=http://localhost:5001/api
```

## Getting a database connection

Use one of these approaches:

1. Ask a project maintainer for the shared development MongoDB URI if you are an approved AWS Student Builder Group maintainer or contributor.
2. Create your own MongoDB Atlas cluster for isolated local development.
3. Run a local MongoDB instance and point `MONGODB_URI` at it.

Production database credentials are restricted and are not distributed to outside collaborators.

## Running without MongoDB

The server can start without `MONGODB_URI` in local development, but database-backed routes will fail or return service-unavailable responses. Configure MongoDB before working on auth, users, newsletters, events, or admin flows.

## Smoke test

Start the app:

```bash
bun run dev
```

Then test the newsletter endpoints:

```bash
curl -X POST http://localhost:5001/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

curl http://localhost:5001/api/newsletter/subscriptions
```

## Notes

- Keep `.env` files local.
- Do not paste database credentials into issues, commits, pull requests, screenshots, or chat logs.
- If you rotate or replace a shared development URI, update the maintainers who rely on it.
