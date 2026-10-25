import { Resend } from "resend";
import { loadEnv } from "./env.js";

export interface DealAlertItem {
  provider: string;
  category: string;
  title: string;
  url: string;
  region: string;
  sellingPrice: number | null;
  originalPrice: number | null;
  faceValue: number | null;
  discountPct: number;
  cashbackPct: number;
  effectiveDiscountPct: number;
  effectivePrice: number | null;
  savingsAmount: number;
  lowestSellerName?: string;
  lowestSellerRating?: number | null;
}

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
  thresholdPct: number;
  matchingDealsCount: number;
}

export interface EmailDispatchResult {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
  thresholdPct: number;
  matchingDealsCount: number;
  recipients?: string[];
  error?: string;
}

export interface EmailConfigStatus {
  configured: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  hasRecipients: boolean;
  thresholdPct: number;
  warningMessage: string | null;
}

/**
 * Checks whether the Resend email client is configured and ready, returning a human-readable
 * startup warning if credentials or recipients are not set up yet.
 */
export function getEmailConfigStatus(): EmailConfigStatus {
  loadEnv();
  const enabled =
    String(process.env.EMAIL_ENABLED ?? "false").toLowerCase() === "true";
  const hasApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasRecipients = Boolean(process.env.ALERT_EMAIL_TO?.trim());
  const thresholdPct =
    Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20;

  const missing: string[] = [];
  if (!hasApiKey) missing.push("RESEND_API_KEY");
  if (!hasRecipients) missing.push("ALERT_EMAIL_TO");

  const configured = enabled && hasApiKey && hasRecipients;
  let warningMessage: string | null = null;

  if (missing.length > 0) {
    warningMessage = `Resend email client is not configured yet (missing ${missing.join(", ")} in .env). Deal alert emails (>= ${thresholdPct}% off) will be skipped until configured via .env or the Web UI.`;
  } else if (!enabled) {
    warningMessage = `Email alerts are currently disabled (EMAIL_ENABLED=false). Deal alert emails (>= ${thresholdPct}% off) will be skipped until enabled.`;
  }

  return {
    configured,
    enabled,
    hasApiKey,
    hasRecipients,
    thresholdPct,
    warningMessage,
  };
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Filters deals whose direct or effective discount meets or exceeds `thresholdPct` (default: 20%).
 */
export function filterAlertableDeals(
  deals: DealAlertItem[],
  thresholdPct?: number,
): DealAlertItem[] {
  loadEnv();
  const threshold =
    thresholdPct ??
    (Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20);

  return deals
    .filter(
      (d) => Math.max(d.discountPct ?? 0, d.effectiveDiscountPct ?? 0) >= threshold,
    )
    .sort((a, b) => b.effectiveDiscountPct - a.effectiveDiscountPct);
}

/**
 * Generates the HTML and plain-text email alert template for deals exceeding the discount threshold.
 */
export function renderDealAlertEmailTemplate(
  deals: DealAlertItem[],
  options: {
    thresholdPct?: number;
    generatedAt?: string;
  } = {},
): EmailTemplateOutput {
  loadEnv();
  const thresholdPct =
    options.thresholdPct ??
    (Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const bestDiscount = deals.reduce(
    (max, d) => Math.max(max, d.effectiveDiscountPct, d.discountPct),
    0,
  );

  const subject =
    deals.length > 0
      ? `🔥 Deal Alert: ${deals.length} Gift Card Deal${deals.length === 1 ? "" : "s"} Over ${thresholdPct}% Off (Up to ${bestDiscount.toFixed(1)}% Off)`
      : `🔔 Deal Alert Preview (Threshold: ${thresholdPct}% Off)`;

  const rowsHtml = deals
    .map((deal, idx) => {
      const baseline = deal.originalPrice ?? deal.faceValue;
      const priceStr =
        deal.sellingPrice !== null ? `$${deal.sellingPrice.toFixed(2)}` : "N/A";
      const baselineStr =
        baseline !== null && baseline !== undefined
          ? `$${baseline.toFixed(2)}`
          : "N/A";
      const effPriceStr =
        deal.effectivePrice !== null
          ? `$${deal.effectivePrice.toFixed(2)}`
          : priceStr;
      const sellerLine = deal.lowestSellerName
        ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">Best Seller: <strong>${escapeHtml(deal.lowestSellerName)}</strong>${deal.lowestSellerRating ? ` (${deal.lowestSellerRating.toFixed(2)}%)` : ""}</div>`
        : "";

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:14px 12px;font-weight:600;color:#0f172a;">#${idx + 1}</td>
          <td style="padding:14px 12px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6366f1;font-weight:700;">
              ${escapeHtml(deal.provider)} • ${escapeHtml(deal.category)}
            </div>
            <a href="${escapeHtml(deal.url)}" style="color:#0f172a;font-weight:600;text-decoration:none;font-size:14px;">
              ${escapeHtml(deal.title)}
            </a>
            <div style="font-size:12px;color:#64748b;">Region: ${escapeHtml(deal.region)}</div>
            ${sellerLine}
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${priceStr}</div>
            <div style="font-size:12px;color:#94a3b8;text-decoration:line-through;">${baselineStr}</div>
            ${deal.cashbackPct > 0 ? `<div style="font-size:11px;color:#059669;">Eff: ${effPriceStr} (+${deal.cashbackPct.toFixed(1)}% CB)</div>` : ""}
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;">
            <span style="display:inline-block;padding:4px 10px;border-radius:9999px;background:#dcfce7;color:#166534;font-weight:700;font-size:13px;">
              -${deal.effectiveDiscountPct.toFixed(2)}%
            </span>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Direct: -${deal.discountPct.toFixed(2)}%</div>
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;">
            <a href="${escapeHtml(deal.url)}" style="display:inline-block;padding:8px 14px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">
              View Deal →
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.05);">
    <div style="background:linear-gradient(135deg,#312e81,#4f46e5);padding:24px 28px;color:#ffffff;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;font-weight:600;">
        Scrapling Deal Monitor Alert
      </div>
      <h1 style="margin:6px 0 4px;font-size:22px;font-weight:700;">
        ${deals.length} Deal${deals.length === 1 ? "" : "s"} Exceeded ${thresholdPct}% Discount Threshold
      </h1>
      <p style="margin:0;font-size:13px;opacity:0.9;">
        Scraped at ${escapeHtml(new Date(generatedAt).toLocaleString())}
      </p>
    </div>

    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.5;">
        The following gift card listings matched your alert rule (discount &ge; <strong>${thresholdPct}%</strong>):
      </p>

      <table style="width:100%;border-collapse:collapse;text-align:left;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;background:#f8fafc;font-size:11px;text-transform:uppercase;color:#475569;">
            <th style="padding:10px 12px;">#</th>
            <th style="padding:10px 12px;">Product</th>
            <th style="padding:10px 12px;text-align:right;">Price</th>
            <th style="padding:10px 12px;text-align:right;">Discount</th>
            <th style="padding:10px 12px;text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Threshold configured via <code>ALERT_DISCOUNT_THRESHOLD_PCT=${thresholdPct}</code></span>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    subject,
    `Scraped at: ${generatedAt}`,
    `Discount threshold: >= ${thresholdPct}%`,
    "-".repeat(72),
    ...deals.map(
      (d, idx) =>
        `${idx + 1}. [${d.provider.toUpperCase()} / ${d.category}] ${d.title} (${d.region})\n` +
        `   Price: $${d.sellingPrice?.toFixed(2) ?? "N/A"} | Eff Discount: ${d.effectiveDiscountPct.toFixed(2)}% (Direct: ${d.discountPct.toFixed(2)}%, Cashback: ${d.cashbackPct.toFixed(2)}%)\n` +
        `   Link: ${d.url}`,
    ),
  ];

  return {
    subject,
    html,
    text: textLines.join("\n\n"),
    thresholdPct,
    matchingDealsCount: deals.length,
  };
}

/**
 * Evaluates scraped deals against `ALERT_DISCOUNT_THRESHOLD_PCT` and sends an alert email via Resend
 * if enabled and configured. Fault-tolerant: never throws on missing credentials or network errors.
 */
export async function sendDealAlertEmail(
  allDeals: DealAlertItem[],
  options: {
    force?: boolean;
    thresholdPct?: number;
    customTo?: string;
  } = {},
): Promise<EmailDispatchResult> {
  loadEnv();
  const thresholdPct =
    options.thresholdPct ??
    (Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT ?? "20") || 20);

  const matchingDeals = filterAlertableDeals(allDeals, thresholdPct);
  const emailEnabled =
    options.force ||
    String(process.env.EMAIL_ENABLED ?? "false").toLowerCase() === "true";

  if (!emailEnabled) {
    return {
      sent: false,
      skipped: true,
      reason: "EMAIL_ENABLED is false in .env",
      thresholdPct,
      matchingDealsCount: matchingDeals.length,
    };
  }

  if (matchingDeals.length === 0) {
    return {
      sent: false,
      skipped: true,
      reason: `No deals met or exceeded the ${thresholdPct}% discount threshold`,
      thresholdPct,
      matchingDealsCount: 0,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      sent: false,
      skipped: true,
      reason: "RESEND_API_KEY is not configured in .env yet",
      thresholdPct,
      matchingDealsCount: matchingDeals.length,
    };
  }

  const rawTo = options.customTo ?? process.env.ALERT_EMAIL_TO ?? "";
  const recipients = rawTo
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      reason: "ALERT_EMAIL_TO is not configured in .env yet",
      thresholdPct,
      matchingDealsCount: matchingDeals.length,
    };
  }

  const fromAddress =
    process.env.ALERT_EMAIL_FROM?.trim() ||
    "Deal Alerts <onboarding@resend.dev>";

  const template = renderDealAlertEmailTemplate(matchingDeals, {
    thresholdPct,
  });

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (response.error) {
      return {
        sent: false,
        skipped: false,
        thresholdPct,
        matchingDealsCount: matchingDeals.length,
        recipients,
        error: response.error.message,
      };
    }

    return {
      sent: true,
      skipped: false,
      messageId: response.data?.id,
      thresholdPct,
      matchingDealsCount: matchingDeals.length,
      recipients,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      skipped: false,
      thresholdPct,
      matchingDealsCount: matchingDeals.length,
      recipients,
      error: message,
    };
  }
}
