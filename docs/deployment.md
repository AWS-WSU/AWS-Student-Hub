# Deployment notes

## Frontend

The frontend is hosted on Vercel.

- App root: `frontend/`
- Build command: `bun run build`
- Output directory: `dist` relative to the `frontend/` app root
- Required Vercel environment variables:
  - `VITE_AUTH0_DOMAIN`
  - `VITE_AUTH0_CLIENT_ID`
  - `VITE_AUTH0_AUDIENCE`
  - `VITE_API_URL`

The old AWS Amplify config has been removed.

## Backend

The backend deploys to AWS Lambda through AWS SAM.

Relevant files:

- `.github/workflows/deploy_lambda.yml`
- `backend/template.yaml`
- `backend/deploy.sh`

The Lambda deploy workflow still owns backend deployment. The frontend Vercel deployment should point at the deployed backend API through `VITE_API_URL`.

### Challenge catalog migration

Deployments upgrading from the legacy challenge scope model must run `bun run migrate-challenge-catalog` once with the target environment's `MONGODB_URI`. Run it before exposing the upgraded API to students. The migration is versioned and safe to rerun; newly created catalog definitions are not auto-assigned.

## Package manager

Deployments use Bun. Use the checked-in `bun.lock` files for reproducible installs.
