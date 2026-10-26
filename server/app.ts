import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { ServerContext } from "./types.js";
import { createUiRouter } from "./routes/ui.routes.js";
import { createDashboardRouter } from "./routes/dashboard.routes.js";
import { createEnebaRouter } from "./routes/eneba.routes.js";
import { createDealsRouter } from "./routes/deals.routes.js";
import { createPagesRouter } from "./routes/pages.routes.js";
import { createScrapeRouter } from "./routes/scrape.routes.js";
import { createConfigRouter } from "./routes/config.routes.js";
import { createSchedulerRouter } from "./routes/scheduler.routes.js";
import { createEmailRouter } from "./routes/email.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, "../frontend/dist/frontend");
const BROWSER_DIST = path.resolve(FRONTEND_DIST, "browser");
const SERVER_MJS = path.resolve(FRONTEND_DIST, "server/server.mjs");

// Try loading Angular SSR request handler if built
let angularReqHandler:
  | ((req: Request, res: Response, next: NextFunction) => void)
  | null = null;

if (fs.existsSync(SERVER_MJS)) {
  try {
    const mod = await import(pathToFileURL(SERVER_MJS).href);
    angularReqHandler = mod.reqHandler;
  } catch (err) {
    console.warn(
      "⚠️  [SSR Warn] Failed to load Angular SSR handler (falling back to template UI):",
      err,
    );
  }
}

export function createApp(ctx: ServerContext): Express {
  const app = express();

  // Middleware: parse JSON request bodies
  app.use(express.json());

  // 1. Mount API route modules first
  app.use("/api/dashboard", createDashboardRouter(ctx));
  app.use("/api/eneba/config", createEnebaRouter(ctx));
  app.use("/api/deals", createDealsRouter(ctx));
  app.use("/api/pages", createPagesRouter(ctx));
  app.use("/api/scrape", createScrapeRouter(ctx));
  app.use(["/api/config", "/api/env"], createConfigRouter(ctx));
  app.use("/api/scheduler", createSchedulerRouter(ctx));
  app.use("/api/email", createEmailRouter(ctx));

  // 2. Serve static Angular browser assets (JS, CSS, images) if built
  if (fs.existsSync(BROWSER_DIST)) {
    app.use(
      express.static(BROWSER_DIST, {
        maxAge: "1y",
        index: false,
        redirect: false,
      }),
    );
  }

  // 3. Mount Angular SSR Handler or fallback UI router
  if (angularReqHandler) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Do not let Angular SSR swallow undefined /api/* routes
      if (req.path.startsWith("/api/")) {
        return next();
      }
      if (req.method === "GET") {
        angularReqHandler!(req, res, next);
      } else {
        next();
      }
    });
  } else {
    app.use(createUiRouter());
  }

  // 4. 404 Handler for undefined API or backend routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // 5. Global Error Handler
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    },
  );

  return app;
}
