import { Router } from "express";
import { renderDashboardHtml } from "../ui/index.js";

export function createUiRouter(): Router {
  const router = Router();

  router.get(["/", "/eneba", "/scraping", "/config"], (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderDashboardHtml());
  });

  return router;
}
