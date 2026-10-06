import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { warmRDKit } from "./services/rdkit";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Compile the RDKit WASM module at boot (~95ms) so the first analysis request
// does not pay for it.
warmRDKit();

const app = express();

// Security headers. CSP is disabled in development because Vite's HMR client
// injects inline scripts; it is enabled in production where assets are static.
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }),
);

/**
 * Body size limits.
 *
 * These were previously 50mb on every route. Only the image-analysis endpoint
 * receives a base64 payload; applying that ceiling everywhere left every other
 * endpoint open to trivial memory exhaustion.
 */
const IMAGE_UPLOAD_LIMIT = "12mb";
const DEFAULT_BODY_LIMIT = "256kb";

app.use("/api/compounds/analyze-image", express.json({ limit: IMAGE_UPLOAD_LIMIT }));
app.use(express.json({ limit: DEFAULT_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: DEFAULT_BODY_LIMIT }));

/**
 * Rate limiting. Every endpoint is unauthenticated, and several proxy to paid
 * Gemini calls or to public services (ChEMBL, PubChem) whose goodwill depends on
 * us not hammering them.
 */
const isDev = process.env.NODE_ENV !== "production";
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: isDev ? 1000 : 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a moment and try again." },
});

// Tighter budget for the routes that cost money or fan out to third parties.
const expensiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: isDev ? 120 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Rate limit reached for this operation. Please wait a moment." },
});

app.use("/api/compounds/analyze-image", expensiveLimiter);
app.use("/api/medicine/analyze-name", expensiveLimiter);
app.use("/api/gemini", expensiveLimiter);
app.use("/api/batch", expensiveLimiter);
app.use("/api", apiLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5001', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
