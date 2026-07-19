<h1 align="center">AWS Student Hub</h1>

<p align="center">
  <a href="https://github.com/AWS-WSU/AWS-Student-Hub/actions/workflows/code_quality.yml">
    <img src="https://github.com/AWS-WSU/AWS-Student-Hub/workflows/Code%20Quality/badge.svg" alt="Code Quality" />
  </a>
  <a href="https://github.com/AWS-WSU/AWS-Student-Hub/actions/workflows/deploy_lambda.yml">
    <img src="https://github.com/AWS-WSU/AWS-Student-Hub/actions/workflows/deploy_lambda.yml/badge.svg" alt="Lambda" />
  </a>
  <a href="https://wayneaws.dev">
    <img src="https://img.shields.io/badge/live-wayneaws.dev-232F3E?style=flat&logo=amazon-aws" alt="Live Site" />
  </a>
</p>

<p align="center">
  <a href="https://wayneaws.dev">
    <img src="https://github.com/user-attachments/assets/9e44c205-24ca-4cfd-9ea4-5ee1dcc7a4a4" width="300" alt="AWS Student Hub banner" />
  </a>
</p>

<p align="center">
  AWS Student Hub is the Wayne State University AWS Cloud Club web platform. It gives students a central place to discover club events, manage accounts, join the Discord community, and access cloud-security challenge resources.
</p>

## Live site

[wayneaws.dev](https://wayneaws.dev)

## Stack

- Frontend: React, Vite, TypeScript, Auth0, Vercel
- Backend: Express, TypeScript, MongoDB, AWS Lambda, AWS SAM
- Package manager: Bun

## Docs

- [Development setup](docs/development.md)
- [Database setup](docs/dbSetup.md)
- [Deployment notes](docs/deployment.md)
- [Contributing](CONTRIBUTING.md)

## Quick start

```bash
bun install
bun install --cwd frontend
bun install --cwd backend
bun run dev
```

The frontend runs at `http://localhost:5173`. The backend API runs at `http://localhost:5001/api`.

## License

This project is licensed under the [MIT License](LICENSE).
