import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const client = axios.create({ baseURL: API_URL });

// Attach the JWT (if present) to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("saajharahat_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Auth -----------------------------------------------------------
export const registerResponder = (payload) =>
  client.post("/auth/responder/register", payload).then((r) => r.data);

export const loginResponder = (payload) =>
  client.post("/auth/responder/login", payload).then((r) => r.data);

export const loginCoordination = (payload) =>
  client.post("/auth/coordination/login", payload).then((r) => r.data);

// --- Wards ------------------------------------------------------------
export const getWards = () => client.get("/wards").then((r) => r.data);

export const getWardPriorities = () =>
  client.get("/wards/priority").then((r) => r.data);

// --- Distributions ------------------------------------------------------
export const logDistribution = (payload) =>
  client.post("/distributions", payload).then((r) => r.data);

export const getMyDistributions = () =>
  client.get("/distributions/mine").then((r) => r.data);

export const getPublicDistributions = (filters = {}) =>
  client.get("/distributions", { params: filters }).then((r) => r.data);

// --- Needs ------------------------------------------------------------
export const reportNeed = (payload) =>
  client.post("/needs", payload).then((r) => r.data);

export const getNeeds = (filters = {}) =>
  client.get("/needs", { params: filters }).then((r) => r.data);

export const claimNeed = (id) =>
  client.post(`/needs/${id}/claim`).then((r) => r.data);

export const unclaimNeed = (id) =>
  client.post(`/needs/${id}/unclaim`).then((r) => r.data);

export const markNeedAddressed = (id) =>
  client.patch(`/needs/${id}/addressed`).then((r) => r.data);

export const getResponders = () => client.get("/auth/responders").then((r) => r.data);
export const assignNeed = (id, responderId) =>
  client.patch(`/needs/${id}/assign`, { responderId }).then((r) => r.data);
export const unassignNeed = (id) => client.patch(`/needs/${id}/unassign`).then((r) => r.data);

// --- Alerts ------------------------------------------------------------
export const getAlerts = (filters = {}) =>
  client.get("/alerts", { params: filters }).then((r) => r.data);

export const getAlert = (id) => client.get(`/alerts/${id}`).then((r) => r.data);

export const confirmAlert = (id) =>
  client.post(`/alerts/${id}/confirm`).then((r) => r.data);

export const dismissAlert = (id) =>
  client.post(`/alerts/${id}/dismiss`).then((r) => r.data);

// --- Analytics ----------------------------------------------------------
export const getVolumeOverTime = () =>
  client.get("/analytics/volume-over-time").then((r) => r.data);

export const getByCategory = () =>
  client.get("/analytics/by-category").then((r) => r.data);

// --- Dashboards ---------------------------------------------------------
export const getResponderDashboard = () =>
  client.get("/dashboard/responder").then((r) => r.data);

export const getCoordinationDashboard = () =>
  client.get("/dashboard/coordination").then((r) => r.data);

export default client;
