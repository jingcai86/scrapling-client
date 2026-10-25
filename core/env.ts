import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

export interface EnvFieldMeta {
  key: string;
  label: string;
  group: "scrapling" | "database" | "scheduler" | "email" | "server";
  description: string;
  defaultValue: string;
  isSecret?: boolean;
  inputType?: "text" | "number" | "time" | "boolean" | "email" | "url";
}

export const ENV_SCHEMA: EnvFieldMeta[] = [
  {
    key: "PORT",
    label: "Server Port",
    group: "server",
    description: "HTTP port for the web dashboard and API server.",
    defaultValue: "3000",
    inputType: "number",
  },
  {
    key: "SCRAPLING_MCP_URL",
    label: "Scrapling MCP Endpoint",
    group: "scrapling",
    description: "Streamable HTTP endpoint for the Scrapling MCP server.",
    defaultValue: "http://localhost:8000/mcp",
    inputType: "url",
  },
  {
    key: "SCRAPLING_TIMEOUT_MS",
    label: "Scrapling Timeout (ms)",
    group: "scrapling",
    description: "Request timeout in milliseconds per Scrapling fetch call.",
    defaultValue: "60000",
    inputType: "number",
  },
  {
    key: "DATABASE_URL",
    label: "PostgreSQL Connection URL",
    group: "database",
    description:
      "Optional PostgreSQL connection string for storing scrape runs, top deals, and competing seller offers.",
    defaultValue: "",
    isSecret: true,
    inputType: "text",
  },
  {
    key: "CRON_ENABLED",
    label: "Enable Daily Cron Job",
    group: "scheduler",
    description: "Whether the daily randomized cron job is active (true/false).",
    defaultValue: "true",
    inputType: "boolean",
  },
  {
    key: "CRON_BASE_TIME",
    label: "Daily Start Time (24h HH:MM)",
    group: "scheduler",
    description:
      "Base start time of the daily scrape window in 24-hour format (e.g., 19:00 for 7:00 PM).",
    defaultValue: "19:00",
    inputType: "time",
  },
  {
    key: "CRON_JITTER_MINUTES",
    label: "Random Jitter Window (Minutes)",
    group: "scheduler",
    description:
      "Random delay added to CRON_BASE_TIME each day (e.g., 60 means a random offset between 0 and 60 minutes, scraping between 7:00 PM and 8:00 PM).",
    defaultValue: "60",
    inputType: "number",
  },
  {
    key: "EMAIL_ENABLED",
    label: "Enable Email Deal Alerts",
    group: "email",
    description:
      "Send email alerts via Resend when a scraped deal meets or exceeds the discount threshold.",
    defaultValue: "false",
    inputType: "boolean",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API Key",
    group: "email",
    description: "Your Resend API key (starts with re_...).",
    defaultValue: "",
    isSecret: true,
    inputType: "text",
  },
  {
    key: "ALERT_EMAIL_FROM",
    label: "Alert Sender Email (From)",
    group: "email",
    description:
      "Verified sender address in Resend (use onboarding@resend.dev for testing).",
    defaultValue: "Deal Alerts <onboarding@resend.dev>",
    inputType: "text",
  },
  {
    key: "ALERT_EMAIL_TO",
    label: "Alert Recipient Email(s) (To)",
    group: "email",
    description:
      "Comma-separated recipient email address(es) to notify on high-discount deals.",
    defaultValue: "",
    inputType: "email",
  },
  {
    key: "ALERT_DISCOUNT_THRESHOLD_PCT",
    label: "Alert Discount Threshold (%)",
    group: "email",
    description:
      "Minimum discount percentage (direct or effective with cashback) that triggers an alert email (e.g., 20 for 20% off).",
    defaultValue: "20",
    inputType: "number",
  },
];

/**
 * Resolves the target `.env` file path.
 */
export function resolveEnvFilePath(customPath?: string): string {
  if (customPath) return path.resolve(customPath);
  const cwdEnv = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(cwdEnv)) return cwdEnv;
  return path.resolve(REPO_ROOT, ".env");
}

/**
 * Parses raw `.env` file content into a key-value map.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Load environment variables from a local `.env` file into `process.env`
 * without overriding already-set environment variables.
 */
export function loadEnv(customPath?: string): void {
  const candidates = customPath
    ? [customPath]
    : [path.resolve(process.cwd(), ".env"), path.resolve(REPO_ROOT, ".env")];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const content = fs.readFileSync(envPath, "utf8");
      const parsed = parseEnvContent(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
      break;
    } catch {
      // Ignore unreadable .env files
    }
  }
}

/**
 * Reads all environment variables from `.env` merged with `ENV_SCHEMA` defaults and `process.env`.
 */
export function readEnvValues(customPath?: string): Record<string, string> {
  const envPath = resolveEnvFilePath(customPath);
  const fileValues: Record<string, string> = fs.existsSync(envPath)
    ? parseEnvContent(fs.readFileSync(envPath, "utf8"))
    : {};

  const merged: Record<string, string> = {};
  for (const field of ENV_SCHEMA) {
    merged[field.key] =
      fileValues[field.key] ?? process.env[field.key] ?? field.defaultValue;
  }

  for (const [k, v] of Object.entries(fileValues)) {
    merged[k] = v;
  }

  return merged;
}

/**
 * Formats a value safely for `.env` lines.
 */
function formatEnvValue(val: string): string {
  const clean = String(val ?? "").replace(/\r?\n/g, " ");
  if (/\s|#/.test(clean) && !/^['"].*['"]$/.test(clean)) {
    return `"${clean.replace(/"/g, '\\"')}"`;
  }
  return clean;
}

/**
 * Updates keys in the `.env` file (preserving comments and line order) and immediately updates `process.env`.
 */
export function updateEnvValues(
  updates: Record<string, string>,
  customPath?: string,
): Record<string, string> {
  const envPath = resolveEnvFilePath(customPath);
  const existingLines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    : [];

  const updatedKeys = new Set<string>();
  const nextLines = existingLines.map((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return rawLine;
    const eqIdx = rawLine.indexOf("=");
    if (eqIdx === -1) return rawLine;
    const key = rawLine.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      updatedKeys.add(key);
      const newVal = updates[key];
      process.env[key] = newVal;
      return `${key}=${formatEnvValue(newVal)}`;
    }
    return rawLine;
  });

  for (const [key, rawVal] of Object.entries(updates)) {
    const cleanKey = key.trim();
    if (!cleanKey || updatedKeys.has(cleanKey)) continue;
    process.env[cleanKey] = rawVal;
    nextLines.push(`${cleanKey}=${formatEnvValue(rawVal)}`);
  }

  const finalContent =
    nextLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n";
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, finalContent, "utf8");

  return readEnvValues(envPath);
}

/**
 * Deletes a key from the `.env` file and removes it from `process.env`.
 */
export function deleteEnvKey(
  keyToRemove: string,
  customPath?: string,
): Record<string, string> {
  const envPath = resolveEnvFilePath(customPath);
  delete process.env[keyToRemove];

  if (fs.existsSync(envPath)) {
    const existingLines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    const filtered = existingLines.filter((rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#")) return true;
      const eqIdx = rawLine.indexOf("=");
      if (eqIdx === -1) return true;
      const key = rawLine.slice(0, eqIdx).trim();
      return key !== keyToRemove;
    });
    fs.writeFileSync(envPath, filtered.join("\n").trimEnd() + "\n", "utf8");
  }

  return readEnvValues(envPath);
}

/**
 * Ensures all default keys from `ENV_SCHEMA` exist in the `.env` file without overwriting existing values.
 */
export function ensureDefaultEnvKeys(customPath?: string): void {
  const envPath = resolveEnvFilePath(customPath);
  const existing = fs.existsSync(envPath)
    ? parseEnvContent(fs.readFileSync(envPath, "utf8"))
    : {};

  const missingUpdates: Record<string, string> = {};
  for (const field of ENV_SCHEMA) {
    if (existing[field.key] === undefined) {
      missingUpdates[field.key] =
        process.env[field.key] ?? field.defaultValue;
    }
  }

  if (Object.keys(missingUpdates).length > 0) {
    updateEnvValues(missingUpdates, envPath);
  }
}
