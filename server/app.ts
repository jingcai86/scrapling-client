import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

export function createApp(ctx: ServerContext): Express {
  const app = express();

  // Middleware: parse JSON request bodies
  app.use(express.json());

  // 1. Mount UI routes (/, /eneba, /scraping, /config)
  app.use(createUiRouter());

  // 2. Mount API route modules
  app.use("/api/dashboard", createDashboardRouter(ctx));
  app.use("/api/eneba/config", createEnebaRouter(ctx));
  app.use("/api/deals", createDealsRouter(ctx));
  app.use("/api/pages", createPagesRouter(ctx));
  app.use("/api/scrape", createScrapeRouter(ctx));
  app.use(["/api/config", "/api/env"], createConfigRouter(ctx));
  app.use("/api/scheduler", createSchedulerRouter(ctx));
  app.use("/api/email", createEmailRouter(ctx));

  // 3. 404 Handler for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // 4. Global Error Handler
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
