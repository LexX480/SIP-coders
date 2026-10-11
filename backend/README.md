# SaajhaRahat — Backend (Node.js + Express + MongoDB)

Phase 1 of the build: API + database. React frontend is Phase 2.

## 1. Install prerequisites

- **Node.js 18+** — https://nodejs.org (LTS)
- **MongoDB** — pick ONE:
  - **Local**: install MongoDB Community Server (https://www.mongodb.com/try/download/community), then run it as a service so `mongod` is always running in the background.
  - **Atlas (no local install, recommended if you don't want to manage a DB)**: create a free cluster at https://www.mongodb.com/cloud/atlas, add your IP to the network access list, create a DB user, and copy the connection string.
- **A REST client** to test endpoints: Postman, Insomnia, or the VS Code "Thunder Client" extension.

## 2. Project setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `MONGO_URI` — either `mongodb://127.0.0.1:27017/saajharahat` (local) or your Atlas connection string.
- `JWT_SECRET` — any long random string (e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output).

## 3. Seed the database

Creates 6 sample wards (Gorkha/Dhading/Sindhupalchok, matching the 2015-earthquake historical-data pilot) plus one demo responder and one demo coordination account.

```bash
npm run seed
```

Demo logins it creates:
- Responder: `demo-responder@saajharahat.test` / `Password123!`
- Coordination (Ward Committee): `demo-coord@saajharahat.test` / `Password123!`

## 4. Run the API

```bash
npm run dev      # auto-restarts on file changes (nodemon)
# or
npm start
```

You should see:
```
MongoDB connected -> saajharahat
SaajhaRahat API running on http://localhost:5000
```

Check it's alive: `GET http://localhost:5000/api/health`

## 5. API reference (maps to prototype screens)

| Screen | Method & Route | Auth |
|---|---|---|
| 2. Responder login/signup | `POST /api/auth/responder/register` | none |
| 2. Responder login/signup | `POST /api/auth/responder/login` | none |
| 3. Responder home stats | `GET /api/dashboard/responder` | responder |
| 4. Log a distribution | `POST /api/distributions` | responder |
| 5. My Distributions | `GET /api/distributions/mine` | responder |
| 6. Report a need | `POST /api/needs` | none (public) |
| 7. Public transparency | `GET /api/distributions?resourceType=&ward=` | none (public) |
| 7. Public transparency (map source) | `GET /api/wards` | none |
| 8. Coordination login | `POST /api/auth/coordination/login` | none |
| — coordination account creation | `POST /api/auth/coordination/register` | none |
| 9. Coordination dashboard stats | `GET /api/dashboard/coordination` | coordination roles |
| 9. Priority-ranked ward list | `GET /api/wards/priority` | none |
| 9. Duplication alerts list | `GET /api/alerts?status=pending` | coordination roles |
| 10. Duplication alert detail | `GET /api/alerts/:id` | coordination roles |
| 10. Confirm Duplicate | `POST /api/alerts/:id/confirm` | coordination roles |
| 10. Dismiss Alert | `POST /api/alerts/:id/dismiss` | coordination roles |
| 11. Volume-over-time chart | `GET /api/analytics/volume-over-time` | coordination roles |
| 11. Allocation-by-category chart | `GET /api/analytics/by-category` | coordination roles |

`coordination roles` = `ward_committee`, `ndrrma`, or `cluster_lead`.

Authenticated requests need the header: `Authorization: Bearer <token>` (token returned by login).

## 6. Quick end-to-end test with curl

```bash
# 1. Log in as the demo responder
curl -s -X POST http://localhost:5000/api/auth/responder/login \
  -H "Content-Type: application/json" \
  -d '{"loginMethod":"email","email":"demo-responder@saajharahat.test","password":"Password123!"}'
# copy the "token" value from the response into TOKEN below

# 2. List wards to get a ward _id
curl -s http://localhost:5000/api/wards

# 3. Log a distribution (replace TOKEN and WARD_ID)
curl -s -X POST http://localhost:5000/api/distributions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"resourceType":"shelter","quantity":20,"ward":"WARD_ID","location":{"coordinates":[84.63,28.0]}}'

# 4. See it on the public transparency dashboard
curl -s http://localhost:5000/api/distributions

# 5. Log tents again from a different logic path to trigger a duplication alert,
#    then check the coordination login + alerts list.
```

## 7. How duplication detection & allocation scoring work right now

Your proposal specifies these as notebook-first ML models (Python, pandas, scikit-learn) integrated later as a service. For the MVP backend to be usable end-to-end today, `utils/duplicationEngine.js` and `utils/allocationEngine.js` contain **rule-based reimplementations** of the same logic described in the proposal (spatiotemporal clustering by ward+resource+time window; weighted scoring by damage severity, population, unmet needs, supply logged, recency). The route contracts (`/api/wards/priority`, the duplication side-effect on `POST /api/distributions`) are already shaped so you can later swap in a real Python microservice call without changing the frontend at all — that's Phase 3 once you build the Jupyter notebook models.

## 8. Note on testing in this environment

I syntax-checked every file (`node --check`) and they're all valid. I could not run a **live** end-to-end test against a real MongoDB inside this sandbox (no local `mongod`, and the sandbox's network allowlist doesn't include MongoDB's download servers) — so please run the curl sequence above yourself once you have Mongo running locally or on Atlas, and tell me if anything errors.

## What's next

Phase 2: React frontend (Vite + Tailwind, matching the exact SaajhaRahat design system — Space Grotesk/Inter, #F7F6F2 background, vermilion/indigo accents) wired to these endpoints, screen-by-screen matching the prototype batches.
