# SaajhaRahat

**Shared effort. Shared relief.**

SaajhaRahat is a disaster-relief coordination platform for Nepal. Relief organizations log what they distribute, communities report what they need, and ward committees see it all in one place, so aid reaches the right people and isn't sent to the same place twice.

## Features

**For relief organizations (responders)**
- Log a distribution with a map pin, item category and quantity
- Claim community needs and see needs assigned to your organization
- Get pickup alerts on your dashboard when a warehouse dispatches stock to you
- Send a delivery out as "on the way". It is only logged to the public register once you mark it delivered

**For ward committees and coordinators**
- Live dashboard of unmet needs, with priority wards ranked on a map
- Duplication alerts when overlapping aid is detected
- Assign a need to a registered organization
- Warehouses with stock ledger, capacity, opening hours and drop-off confirmation
- Dispatch warehouse stock straight to an open need
- Analytics for distributions, warehouse stock and dispatch performance

**For the public (no login)**
- Report a community need
- Pledge a material drop-off at a nearby warehouse
- Browse the public transparency dashboard of all logged distributions

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Recharts, OpenStreetMap |
| Backend | Node.js, Express, Mongoose, JWT, bcryptjs, express-validator |
| Database | MongoDB |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

## Project structure

```
backend/    Express API: config, middleware, models, routes, seed, utils
frontend/   React app: pages, components, context, api client
```


## Deployment

- **Database:** MongoDB Atlas free cluster
- **Backend:** Render web service with root directory `backend`, build `npm install`, start `npm start`. Environment variables: `MONGO_URI`, `JWT_SECRET`, and optionally `CLIENT_URL` to restrict CORS
- **Frontend:** Vercel with root directory `frontend` and the environment variable `VITE_API_URL=https://<your-backend>/api`. 


## Roles

| Role | Access |
|---|---|
| Public | Report needs, pledge drop-offs, view transparency dashboard |
| Responder | Log distributions, claim needs, handle pickups and deliveries |
| Ward committee, NDRRMA, cluster lead | Coordination console: dashboard, alerts, warehouses, analytics |

