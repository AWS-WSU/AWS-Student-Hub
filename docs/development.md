# Development setup

This project uses Bun for package management and local scripts.

## Requirements

- Bun 1.3+
- Node.js 20+ for Node-based tooling and AWS Lambda parity
- Access to the required `.env` values for the features you are working on

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Install dependencies

From the repository root:

```bash
bun install
bun install --cwd frontend
bun install --cwd backend
```

## Environment files

Create these files locally. Do not commit them.

### `frontend/.env`

```env
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=your-auth0-api-audience
VITE_API_URL=http://localhost:5001/api
```

### `backend/.env`

```env
MONGODB_URI=your-mongodb-uri
ADMIN_TOKEN=your-admin-token
JWT_SECRET=your-jwt-secret
PORT=5001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

S3_ACCESS_KEY_ID=your-s3-upload-access-key-id
S3_SECRET_ACCESS_KEY=your-s3-upload-secret-access-key
S3_REGION=us-east-2
S3_BUCKET_NAME=aws-student-hub-profile-pictures
AWS_HUB_EVENT_THUMBNAILS=aws-student-hub-event-thumbnails

AWS_ADMIN_ACCESS_KEY_ID=your-aws-admin-access-key-id
AWS_ADMIN_SECRET_ACCESS_KEY=your-aws-admin-secret-access-key
CUSTOM_AWS_REGION=us-east-1
AWS_S3_BUCKET=wayne-aws-club-secrets

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_ENCRYPTION=STARTTLS
SMTP_USER=your-email
SMTP_PASS=your-email-password

DISCORD_BOT_TOKEN=<contact-a-project-maintainer>
DISCORD_GUILD_ID=<contact-a-project-maintainer>
DISCORD_CHANNEL_ID=<contact-a-project-maintainer>
```

You do not need every optional service configured for basic frontend/backend development. Features that depend on MongoDB, S3, email, Discord, or AWS challenge provisioning will need their matching variables.

## Run locally

```bash
bun run dev
```

This starts both apps with named log prefixes:

```bash
concurrently --names frontend,backend --prefix-colors cyan,green --prefix "[{time}] [{name}]" --timestamp-format HH:mm:ss "bun run --silent --cwd frontend dev" "bun run --silent --cwd backend dev"
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api`

Example local dev output:

<img width="824" alt="Local dev terminal output" src="https://github.com/user-attachments/assets/9187283c-346b-4f8d-b75c-d0cab6e2b57e" />

## Useful scripts

From the repository root:

```bash
bun run dev
bun run dev:frontend
bun run dev:backend
bun run build
bun run typecheck
bun run lint
```

Scoped package scripts also work:

```bash
bun run --cwd frontend build
bun run --cwd backend typecheck
```

## Project layout

```txt
backend/     express api, lambda handler, database models, aws/email services
frontend/    react/vite app
docs/        project documentation
.github/     ci and deployment workflows
```
