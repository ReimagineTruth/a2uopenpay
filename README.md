# A2U OpenPay

This repo contains:
- A Vite + React frontend (`/`)
- A Node.js Pi Network A2U backend service (`nodejs-a2u-backend/`)
- Ruby helper/test scripts for Pi Network (`*.rb` in repo root)

## Secrets

- Create `.env` from `.env.example` and keep it private.
- Never commit `.env` (it is gitignored).

## Frontend

```bash
npm install
npm run dev
```

## Pi A2U Backend (Node.js)

```bash
cd nodejs-a2u-backend
npm install
cp .env.example .env
npm run dev
```

## Pi A2U Tests

See `README_PI_TEST.md`.
