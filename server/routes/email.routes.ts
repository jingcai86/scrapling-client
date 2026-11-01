import { Router } from "express";
import {
  filterAlertableDeals,
  renderDealAlertEmailTemplate,
  sendDealAlertEmail,
  type DealAlertItem,
} from "../../core/index.js";
import { getProviderAlertThreshold } from "../../eneba/db.js";
import { statusesToAlertItems } from "../services/scrapeRunner.js";
import type { ServerContext } from "../types.js";

const SAMPLE_PREVIEW_DEALS: DealAlertItem[] = [
  {
    provider: "eneba",
    category: "Nintendo eShop Gift Cards",
    title: "Nintendo eShop Card 70 USD Key UNITED STATES",
    url: "https://www.eneba.com/us/nintendo-nintendo-eshop-card-70-usd-key-united-states",
    region: "United States",
    sellingPrice: 54.6,
    originalPrice: 70,
    faceValue: 70,
    discountPct: 22,
    cashbackPct: 0,
    effectiveDiscountPct: 22,
    effectivePrice: 54.6,
    savingsAmount: 15.4,
    lowestSellerName: "GameDealPro",
    lowestSellerRating: 99.84,
  },
  {
    provider: "eneba",
    category: "PlayStation (PSN) Gift Cards",
    title: "PlayStation Network Card 100 USD (USA) PSN Key UNITED STATES",
    url: "https://www.eneba.com/us/psn-playstation-network-card-psn-100-usd-usa-psn-key-united-states",
    region: "United States",
    sellingPrice: 79.0,
    originalPrice: 100,
    faceValue: 100,
    discountPct: 21,
    cashbackPct: 0,
    effectiveDiscountPct: 21,
    effectivePrice: 79.0,
    savingsAmount: 21.0,
    lowestSellerName: "KeyVaultUS",
    lowestSellerRating: 99.52,
  },
  {
    provider: "g2a",
    category: "Google Play Gift Cards",
    title: "Google Play Gift Card 100 USD Key UNITED STATES",
    url: "https://www.g2a.com/google-play-gift-card-100-usd-android-united-states-i10000001432018",
    region: "United States",
    sellingPrice: 79.5,
    originalPrice: 100,
    faceValue: 100,
    discountPct: 20.5,
    cashbackPct: 0,
    effectiveDiscountPct: 20.5,
    effectivePrice: 79.5,
    savingsAmount: 20.5,
    lowestSellerName: "DigitalKeysDirect",
    lowestSellerRating: 99.1,
  },
];

export function createEmailRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get("/preview", async (_req, res, next) => {
    try {
      const [enebaThreshold, g2aThreshold] = await Promise.all([
        getProviderAlertThreshold("eneba", { pool: ctx.pool }),
        getProviderAlertThreshold("g2a", { pool: ctx.pool }),
      ]);
      const providerThresholds = {
        eneba: enebaThreshold,
        g2a: g2aThreshold,
      };
      const thresholdPct = Math.min(enebaThreshold, g2aThreshold);
      const liveItems = statusesToAlertItems(ctx.runner.getLatestStatuses());
      const matchingLive = filterAlertableDeals(liveItems, providerThresholds);
      const dealsForPreview =
        matchingLive.length > 0 ? matchingLive : SAMPLE_PREVIEW_DEALS;

      const template = renderDealAlertEmailTemplate(dealsForPreview, {
        thresholdPct,
      });
      res.json({
        ...template,
        isSampleData: matchingLive.length === 0,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/test", async (req, res, next) => {
    try {
      const [enebaThreshold, g2aThreshold] = await Promise.all([
        getProviderAlertThreshold("eneba", { pool: ctx.pool }),
        getProviderAlertThreshold("g2a", { pool: ctx.pool }),
      ]);
      const providerThresholds = {
        eneba: enebaThreshold,
        g2a: g2aThreshold,
      };
      const thresholdPct = Math.min(enebaThreshold, g2aThreshold);
      const liveItems = statusesToAlertItems(ctx.runner.getLatestStatuses());
      const matchingLive = filterAlertableDeals(liveItems, providerThresholds);
      const dealsToSend =
        matchingLive.length > 0 ? matchingLive : SAMPLE_PREVIEW_DEALS;

      const customTo =
        typeof req.body?.to === "string" && req.body.to.trim()
          ? req.body.to.trim()
          : undefined;

      const result = await sendDealAlertEmail(dealsToSend, {
        force: true,
        thresholdPct,
        providerThresholds,
        customTo,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
