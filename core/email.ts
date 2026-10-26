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
    warningMessage = `Resend email client is not configured yet (missing ${missing.join(", ")} in .env). Email alerts will be skipped until configured via .env or the Web UI.`;
  } else if (!enabled) {
    warningMessage = `Email alerts are currently disabled (EMAIL_ENABLED=false). Email alerts will be skipped until enabled.`;
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
 * Filters deals whose discount meets or exceeds individual provider thresholds or a specific threshold.
 */
export function filterAlertableDeals(
  deals: DealAlertItem[],
  thresholdOption?: number | Record<string, number>,
): DealAlertItem[] {
  loadEnv();
  return deals
    .filter((d) => {
      let threshold = 20;
      if (typeof thresholdOption === "number") {
        threshold = thresholdOption;
      } else if (thresholdOption && typeof thresholdOption === "object") {
        threshold = thresholdOption[d.provider?.toLowerCase()] ?? 20;
      } else if (process.env.ALERT_DISCOUNT_THRESHOLD_PCT) {
        threshold = Number(process.env.ALERT_DISCOUNT_THRESHOLD_PCT) || 20;
      }
      return (d.discountPct ?? 0) >= threshold;
    })
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
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
  const timeZone = process.env.TZ?.trim() || "America/Los_Angeles";
  let formattedGeneratedAt: string;
  try {
    formattedGeneratedAt = new Date(generatedAt).toLocaleString("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    formattedGeneratedAt = new Date(generatedAt).toLocaleString("en-US");
  }

  const bestDiscount = deals.reduce(
    (max, d) => Math.max(max, d.discountPct),
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
      const savings =
        deal.savingsAmount ??
        (baseline !== null && baseline !== undefined && deal.sellingPrice !== null
          ? Math.max(0, baseline - deal.sellingPrice)
          : 0);
      const savingsStr =
        savings > 0
          ? `<div style="font-size:11px;color:#16a34a;font-weight:700;margin-top:2px;">Save $${savings.toFixed(2)}</div>`
          : "";

      const sellerLine = deal.lowestSellerName
        ? `<div style="font-size:11.5px;color:#64748b;margin-top:4px;">🏪 Seller: <strong style="color:#334155;">${escapeHtml(deal.lowestSellerName)}</strong>${deal.lowestSellerRating ? ` <span style="display:inline-block;background:#dcfce7;color:#166534;font-size:10.5px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:3px;">${deal.lowestSellerRating.toFixed(2)}%</span>` : ""}</div>`
        : "";

      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      const rankBadge =
        idx === 0
          ? `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#fef3c7;color:#92400e;font-weight:800;font-size:11.5px;border:1px solid #fde68a;">🏆 #1</span>`
          : `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-weight:700;font-size:11.5px;border:1px solid #e2e8f0;">#${idx + 1}</span>`;

      return `
        <tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
          <td style="padding:14px 12px;text-align:center;vertical-align:middle;white-space:nowrap;">
            ${rankBadge}
          </td>
          <td style="padding:14px 12px;vertical-align:middle;">
            <div style="margin-bottom:4px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#e0e7ff;color:#3730a3;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
                ${escapeHtml(deal.provider)} • ${escapeHtml(deal.category)}
              </span>
            </div>
            <a href="${escapeHtml(deal.url)}" target="_blank" style="color:#0f172a;font-weight:700;text-decoration:none;font-size:13.5px;line-height:1.35;display:block;">
              ${escapeHtml(deal.title)}
            </a>
            ${sellerLine}
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;vertical-align:middle;">
            <div style="font-size:15px;font-weight:800;color:#0f172a;">${priceStr}</div>
            <div style="font-size:11.5px;color:#94a3b8;text-decoration:line-through;margin-top:1px;">${baselineStr}</div>
            ${savingsStr}
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;vertical-align:middle;">
            <span style="display:inline-block;padding:5px 10px;border-radius:9999px;background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:800;font-size:12.5px;box-shadow:0 1px 2px rgba(22,101,52,0.08);">
              -${deal.discountPct.toFixed(2)}%
            </span>
          </td>
          <td style="padding:14px 12px;text-align:right;white-space:nowrap;vertical-align:middle;">
            <a href="${escapeHtml(deal.url)}" target="_blank" style="display:inline-block;padding:8px 14px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:700;box-shadow:0 2px 4px rgba(79,70,229,0.25);">
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:16px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;box-sizing:border-box;">
  <div style="max-width:100%;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #cbd5e1;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <div style="background:linear-gradient(135deg,#312e81,#4f46e5);padding:22px 26px;color:#ffffff;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;font-weight:700;">
        Scrapling Monitor Alert
      </div>
      <h1 style="margin:6px 0 4px;font-size:20px;font-weight:700;">
        ${deals.length} Deal${deals.length === 1 ? "" : "s"} Exceeded ${thresholdPct}% Discount Threshold
      </h1>
      <p style="margin:0;font-size:12.5px;opacity:0.9;">
        Scraped at ${escapeHtml(formattedGeneratedAt)}
      </p>
    </div>

    <div style="padding:22px 24px;">
      <div style="margin:0 0 16px;padding:10px 14px;background:#eef2ff;border-left:4px solid #4f46e5;border-radius:6px;font-size:13.5px;color:#1e1b4b;font-weight:600;">
        The following gift card listings matched your alert rule (discount &ge; <strong>${thresholdPct}%</strong>):
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;text-align:left;">
        <thead>
          <tr style="background:#1e293b;color:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">
            <th style="padding:12px 14px;font-weight:700;text-align:center;width:60px;"># Rank</th>
            <th style="padding:12px 14px;font-weight:700;">Product &amp; Category</th>
            <th style="padding:12px 14px;font-weight:700;text-align:right;">Price</th>
            <th style="padding:12px 14px;font-weight:700;text-align:right;">Discount</th>
            <th style="padding:12px 14px;font-weight:700;text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Thresholds evaluated at individual provider level</span>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    subject,
    `Scraped at: ${formattedGeneratedAt}`,
    `Discount threshold: evaluated per provider (>= ${thresholdPct}%)`,
    "-".repeat(72),
    ...deals.map(
      (d, idx) =>
        `${idx + 1}. [${d.provider.toUpperCase()} / ${d.category}] ${d.title} (${d.region})\n` +
        `   Price: $${d.sellingPrice?.toFixed(2) ?? "N/A"} | Discount: ${d.discountPct.toFixed(2)}%\n` +
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
 * Evaluates scraped deals against provider discount thresholds and sends an alert email via Resend
 * if enabled and configured. Fault-tolerant: never throws on missing credentials or network errors.
 */
export async function sendDealAlertEmail(
  allDeals: DealAlertItem[],
  options: {
    force?: boolean;
    thresholdPct?: number | Record<string, number>;
    providerThresholds?: Record<string, number>;
    customTo?: string;
  } = {},
): Promise<EmailDispatchResult> {
  loadEnv();
  const thresholdOption = options.providerThresholds ?? options.thresholdPct;
  const matchingDeals = filterAlertableDeals(allDeals, thresholdOption);
  const thresholdPct =
    typeof options.thresholdPct === "number"
      ? options.thresholdPct
      : 20;
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
