import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { startWorker, clearAllJobs } from "./services/jobs";
import { initStorage } from "./services/storage";
import { startAutoBackup } from "./services/backup";
import { startMemoryAutoEvaluator } from "./services/memoryAutoEvaluator";
import { logger } from "./utils/logger";
import contextRoutes from "./routes/context";
import graphRoutes from "./routes/graph";
import chatRoutes from "./routes/chat";
import ragRoutes from "./routes/rag";
import sessionRoutes from "./routes/session";
import jobsRoutes from "./routes/jobs";
import healthRoutes from "./routes/health";
import settingsRoutes from "./routes/settings";
import memoriesRoutes from "./routes/memories";
import workingMemoryRoutes from "./routes/workingMemory";
import toolsRoutes from "./routes/tools";
import modelsRoutes from "./routes/models";
import sourcesRoutes from "./routes/sources";
import communitiesRoutes from "./routes/communities";
import intelligenceRoutes from "./routes/intelligence";
import migrationRoutes from "./routes/migration";
import skillsRoutes from "./routes/skills";


// ── Pure SQLite Environment Initialization ──────────
function validateEnv() {
  if (process.env.GRAPH_BACKEND === "groq" && !process.env.GROQ_API_KEY) {
    logger.warn("[ArcRift] GRAPH_BACKEND is set to 'groq' but GROQ_API_KEY is missing. You can configure API keys in Settings.");
  }
}
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Issue #3 Fix: Restrict CORS to trusted origins only
// MUST be the very first middleware so errors and preflights always have CORS headers
const ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`, // Dashboard (production build — v1.4.7)
  `http://127.0.0.1:${PORT}`,
  "http://localhost:3001",   // Default port fallback
  "http://127.0.0.1:3001",
  "http://localhost:5173",   // Vite dashboard (dev)
  "http://localhost:5174",   // Vite dashboard (dev alt)
  "http://localhost:4173",   // Vite dashboard (preview)
  "http://tauri.localhost",
  "tauri://localhost",
  "app://.",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (chrome-extension, Electron file://, Postman, curl)
    if (!origin) return callback(null, true);
    // Allow chrome-extension:// and moz-extension:// schemes
    if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) return callback(null, true);
    // Allow any localhost / 127.0.0.1 origin (with any port)
    if (origin.includes("://localhost") || origin.includes("://127.0.0.1")) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-ArcRift-Secret"],
  credentials: true,
}));

// Body parser — Support large batch session & chat imports (up to 100MB)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
// Issue #13 Fix: Rate limiting to prevent abuse of the expensive LLM pipeline
// Global limiter: 200 requests per minute per IP across all endpoints
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
});

// Strict limiter for the expensive /api/chat/save route (LLM + vector ops)
// 10 saves per minute is more than enough for normal usage
const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many save requests. Please wait before saving again." },
});

// #14: Security headers via helmet
app.use(helmet({ contentSecurityPolicy: false })); // CSP off — API-only server, no HTML

// v1.4.7: Auth middleware removed for better local-first UX

// Apply global rate limit across ALL routes (200 req/min per IP)
app.use(globalLimiter);

// Routes
app.use("/api/context", contextRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/chat/save", saveLimiter); // strict limit — BEFORE the route handler
app.use("/api/chat", chatRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/memories", memoriesRoutes);
app.use("/api/working-memory", workingMemoryRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/models", modelsRoutes);
app.use("/api/sources", sourcesRoutes);
app.use("/api/communities", communitiesRoutes);
app.use("/api/intelligence", intelligenceRoutes);
app.use("/api/migration", migrationRoutes);
app.use("/api/skills", skillsRoutes);

// Health check — includes service status
app.get("/health", (_req, res) => {
  res.json({
    status: "ArcRift backend running",
    version: "1.6.3",
    services: {
      backend: "ok",
      port: PORT,
    },
  });
});

// API Error Handler (e.g. body-parser errors, unexpected errors)
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  logger.error("[ArcRift] API Error Handler:", err?.message || err);
  if (err?.type === "entity.too.large" || err?.status === 413) {
    res.status(413).json({ error: "Payload too large. Please import in smaller batches." });
    return;
  }
  res.status(err?.status || 500).json({ error: err?.message || "Internal server error" });
});

// ── Serve production dashboard build via express.static ─────────────
const dashboardDist = path.resolve(__dirname, "../../dashboard/dist");
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  // Express 5 compatible SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dashboardDist, "index.html"));
  });
  logger.success(`[ArcRift] Dashboard served from production build: \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`);
} else {
  logger.warn(
    `[ArcRift] No dashboard build found at ${dashboardDist}. ` +
    "Run: cd dashboard && npm run build"
  );
}

async function start() {
  try {
    await initStorage();
    
    // Initialize auto-backup service
    startAutoBackup();

    // Start autonomous periodic memory self-evaluation & calibration
    startMemoryAutoEvaluator();

    // Start background job worker for extraction tasks
    await startWorker();
  } catch (err) {
    logger.error("Fatal: Database connection failed. ArcRift cannot start.");
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.success(`ArcRift backend running on port \x1b[1;96m${PORT}\x1b[0m`);
  });
}

process.on("uncaughtException", (err) => {
  logger.error("[ArcRift] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[ArcRift] Unhandled Promise Rejection:", reason);
});

start().catch(err => {
  logger.error("Unhandled error during startup:");
  logger.error(err);
  process.exit(1);
});
