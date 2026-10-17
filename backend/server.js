require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const distributionRoutes = require("./routes/distributions.routes");
const needsRoutes = require("./routes/needs.routes");
const wardsRoutes = require("./routes/wards.routes");
const alertsRoutes = require("./routes/alerts.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const warehousesRoutes = require("./routes/warehouses.routes");
const dropoffsRoutes = require("./routes/dropoffs.routes");
const dispatchesRoutes = require("./routes/dispatches.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "SaajhaRahat API" }));

app.use("/api/auth", authRoutes);
app.use("/api/distributions", distributionRoutes);
app.use("/api/needs", needsRoutes);
app.use("/api/wards", wardsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/dropoffs", dropoffsRoutes);
app.use("/api/dispatches", dispatchesRoutes);

// 404 fallback
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error", error: err.message });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`SaajhaRahat API running on http://localhost:${PORT}`));
});