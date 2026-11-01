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

  const maxSavings = deals.reduce((max, d) => {
    const baseline = d.originalPrice ?? d.faceValue;
    const sav =
      d.savingsAmount ??
      (baseline !== null && baseline !== undefined && d.sellingPrice !== null
        ? Math.max(0, baseline - d.sellingPrice)
        : 0);
    return Math.max(max, sav);
  }, 0);

  const uniqueProviders = Array.from(
    new Set(deals.map((d) => (d.provider || "eneba").toUpperCase())),
  );
  const providersLabel =
    uniqueProviders.length > 0 ? uniqueProviders.join(" · ") : "ENEBA · G2A";

  const subject =
    deals.length > 0
      ? `[Scrapling Alert] ${deals.length} Gift Card Deal${deals.length === 1 ? "" : "s"} Over ${thresholdPct}% Off (Up to ${bestDiscount.toFixed(1)}% Off)`
      : `[Scrapling Alert] Deal Alert Preview (Threshold: ${thresholdPct}% Off)`;

  const topDeal = deals[0];
  const topDealBaseline = topDeal
    ? (topDeal.originalPrice ?? topDeal.faceValue)
    : null;
  const topDealSavings = topDeal
    ? (topDeal.savingsAmount ??
      (topDealBaseline !== null &&
      topDealBaseline !== undefined &&
      topDeal.sellingPrice !== null
        ? Math.max(0, topDealBaseline - topDeal.sellingPrice)
        : 0))
    : 0;

  const spotlightHtml = topDeal
    ? `
      <div style="margin:0 0 22px;padding:18px 20px;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 100%);border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,0.04);">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;padding-right:16px;">
              <div style="margin-bottom:8px;">
                <span style="display:inline-block;padding:3px 8px;border-radius:5px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
                  Top Deal #1
                </span>
                <span style="display:inline-block;margin-left:6px;padding:3px 8px;border-radius:5px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
                  ${escapeHtml(topDeal.provider)}
                </span>
                <span style="display:inline-block;margin-left:6px;font-size:11.5px;color:#64748b;font-weight:500;">
                  ${escapeHtml(topDeal.category)}${topDeal.region ? ` · ${escapeHtml(topDeal.region)}` : ""}
                </span>
              </div>
              <a href="${escapeHtml(topDeal.url)}" target="_blank" style="color:#0f172a;font-weight:700;text-decoration:none;font-size:15.5px;line-height:1.4;display:block;letter-spacing:-0.01em;">
                ${escapeHtml(topDeal.title)}
              </a>
              ${
                topDeal.lowestSellerName
                  ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">
                      Lowest Seller: <strong style="color:#334155;font-weight:600;">${escapeHtml(topDeal.lowestSellerName)}</strong>
                      ${
                        topDeal.lowestSellerRating
                          ? `<span style="display:inline-block;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:4px;margin-left:4px;">${topDeal.lowestSellerRating.toFixed(2)}% positive</span>`
                          : ""
                      }
                    </div>`
                  : ""
              }
            </td>
            <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
              <div style="font-size:20px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">
                ${topDeal.sellingPrice !== null ? `$${topDeal.sellingPrice.toFixed(2)}` : "N/A"}
              </div>
              <div style="font-size:11.5px;color:#64748b;margin-top:2px;font-variant-numeric:tabular-nums;">
                ${
                  topDealBaseline !== null && topDealBaseline !== undefined
                    ? `<span style="text-decoration:line-through;color:#94a3b8;">$${topDealBaseline.toFixed(2)}</span>`
                    : ""
                }
                ${
                  topDealSavings > 0
                    ? `<span style="color:#059669;font-weight:600;margin-left:4px;">Save $${topDealSavings.toFixed(2)}</span>`
                    : ""
                }
              </div>
              <div style="margin-top:10px;">
                <a href="${escapeHtml(topDeal.url)}" target="_blank" style="display:inline-block;padding:8px 14px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:7px;font-size:12px;font-weight:600;letter-spacing:0.01em;">
                  Claim Deal &rarr;
                </a>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
    : "";

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
        (baseline !== null &&
        baseline !== undefined &&
        deal.sellingPrice !== null
          ? Math.max(0, baseline - deal.sellingPrice)
          : 0);
      const savingsStr =
        savings > 0
          ? `<div style="font-size:11px;color:#059669;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums;">Save $${savings.toFixed(2)}</div>`
          : "";

      const sellerLine = deal.lowestSellerName
        ? `<div style="font-size:11.5px;color:#64748b;margin-top:4px;">Seller: <strong style="color:#334155;font-weight:600;">${escapeHtml(deal.lowestSellerName)}</strong>${deal.lowestSellerRating ? ` <span style="display:inline-block;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;font-size:10.5px;font-weight:600;padding:0px 5px;border-radius:4px;margin-left:4px;">${deal.lowestSellerRating.toFixed(2)}%</span>` : ""}</div>`
        : "";

      const isG2a = (deal.provider || "").toLowerCase() === "g2a";
      const providerBadgeStyle = isG2a
        ? "background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;"
        : "background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;";

      const rowBg = idx % 2 === 0 ? "#ffffff" : "#fcfcfd";
      const rankBadge =
        idx === 0
          ? `<span style="display:inline-block;min-width:26px;padding:3px 7px;border-radius:6px;background:#fef3c7;color:#b45309;font-weight:700;font-size:11px;border:1px solid #fde68a;font-variant-numeric:tabular-nums;">#1</span>`
          : `<span style="display:inline-block;min-width:26px;padding:3px 7px;border-radius:6px;background:#f1f5f9;color:#475569;font-weight:600;font-size:11px;border:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">#${idx + 1}</span>`;

      return `
        <tr style="background:${rowBg};">
          <td style="padding:14px 12px;border-top:1px solid #e2e8f0;text-align:center;vertical-align:middle;white-space:nowrap;">
            ${rankBadge}
          </td>
          <td style="padding:14px 12px;border-top:1px solid #e2e8f0;vertical-align:middle;">
            <div style="margin-bottom:5px;">
              <span style="display:inline-block;padding:1.5px 7px;border-radius:4px;${providerBadgeStyle}font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
                ${escapeHtml(deal.provider)}
              </span>
              <span style="display:inline-block;margin-left:5px;font-size:11px;color:#64748b;font-weight:500;">
                ${escapeHtml(deal.category)}${deal.region ? ` · ${escapeHtml(deal.region)}` : ""}
              </span>
            </div>
            <a href="${escapeHtml(deal.url)}" target="_blank" style="color:#0f172a;font-weight:600;text-decoration:none;font-size:13.5px;line-height:1.35;display:block;">
              ${escapeHtml(deal.title)}
            </a>
            ${sellerLine}
          </td>
          <td style="padding:14px 12px;border-top:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:middle;font-variant-numeric:tabular-nums;">
            <div style="font-size:14.5px;font-weight:700;color:#0f172a;">${priceStr}</div>
            <div style="font-size:11px;color:#94a3b8;text-decoration:line-through;margin-top:1px;">${baselineStr}</div>
            ${savingsStr}
          </td>
          <td style="padding:14px 12px;border-top:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:middle;font-variant-numeric:tabular-nums;">
            <span style="display:inline-block;padding:4px 9px;border-radius:9999px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:700;font-size:12px;">
              -${deal.discountPct.toFixed(2)}%
            </span>
          </td>
          <td style="padding:14px 14px 14px 10px;border-top:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:middle;">
            <a href="${escapeHtml(deal.url)}" target="_blank" style="display:inline-block;padding:7px 12px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:11.5px;font-weight:600;">
              Open &nearr;
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
<body style="margin:0;padding:24px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;box-sizing:border-box;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px -4px rgba(15,23,42,0.06);">
    <div style="height:4px;background:linear-gradient(90deg,#4f46e5 0%,#6366f1 50%,#10b981 100%);"></div>

    <div style="padding:24px 28px 20px;border-bottom:1px solid #f1f5f9;">
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="vertical-align:middle;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:#4f46e5;margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#4f46e5;font-weight:700;vertical-align:middle;">
              Scrapling Monitor Alert
            </span>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <span style="display:inline-block;padding:3px 9px;border-radius:9999px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;font-size:11px;font-weight:600;">
              Rule: Discount &ge; ${thresholdPct}%
            </span>
          </td>
        </tr>
      </table>

      <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.3;">
        ${deals.length} Gift Card Deal${deals.length === 1 ? "" : "s"} Exceeded Your ${thresholdPct}% Alert Threshold
      </h1>
      <p style="margin:0;font-size:12.5px;color:#64748b;">
        Evaluated at ${escapeHtml(formattedGeneratedAt)} &middot; Ranked by highest discount
      </p>
    </div>

    <div style="padding:22px 28px 26px;">
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 -10px 22px;width:calc(100% + 20px);">
        <tr>
          <td style="width:33.33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;vertical-align:top;">
            <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Matching Deals</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px;font-variant-numeric:tabular-nums;">${deals.length}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(providersLabel)}</div>
          </td>
          <td style="width:33.33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;vertical-align:top;">
            <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Peak Discount</div>
            <div style="font-size:20px;font-weight:700;color:#059669;margin-top:4px;font-variant-numeric:tabular-nums;">-${bestDiscount.toFixed(2)}%</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">Threshold &ge; ${thresholdPct}%</div>
          </td>
          <td style="width:33.33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;vertical-align:top;">
            <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Max Savings</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px;font-variant-numeric:tabular-nums;">$${maxSavings.toFixed(2)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">Off retail face value</div>
          </td>
        </tr>
      </table>

      ${spotlightHtml}

      <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;margin:0 0 10px;">
        All Qualifying Listings (${deals.length})
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#ffffff;text-align:left;">
        <thead>
          <tr style="background:#f8fafc;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;">
            <th style="padding:10px 12px;font-weight:600;text-align:center;width:48px;">Rank</th>
            <th style="padding:10px 12px;font-weight:600;">Listing &amp; Seller</th>
            <th style="padding:10px 12px;font-weight:600;text-align:right;">Price</th>
            <th style="padding:10px 12px;font-weight:600;text-align:right;">Discount</th>
            <th style="padding:10px 14px 10px 10px;font-weight:600;text-align:right;">Offer</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11.5px;color:#64748b;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td>Scrapling Deal Monitor &middot; Automated Price Surveillance</td>
          <td style="text-align:right;color:#94a3b8;">Thresholds evaluated per marketplace</td>
        </tr>
      </table>
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
