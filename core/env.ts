import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

export interface EnvFieldMeta {
  key: string;
  label: string;
  group: "env" | "scrapling" | "scheduler" | "email";
  description: string;
  defaultValue: string;
  /** If true, this setting must live in `.env` (read-only in UI; requires server restart if changed). */
  envOnly?: boolean;
  isSecret?: boolean;
  inputType?: "text" | "number" | "time" | "boolean" | "email" | "url";
}

export const ENV_ONLY_KEYS = new Set<string>(["PORT", "DATABASE_URL"]);

export const ENV_SCHEMA: EnvFieldMeta[] = [
  {
    key: "PORT",
    label: "Server Port",
    group: "env",
    description:
      "HTTP port for the web dashboard and API server. Stored in .env (requires restart if changed).",
    defaultValue: "80",
    envOnly: true,
    inputType: "number",
  },
  {
    key: "DATABASE_URL",
    label: "PostgreSQL Connection URL",
    group: "env",
    description:
      "PostgreSQL connection string for schema 'scrapling'. Stored in .env (requires restart if changed).",
    defaultValue: "",
    envOnly: true,
    isSecret: true,
    inputType: "text",
  },
  {
    key: "SCRAPLING_MCP_URL",
    label: "Scrapling MCP Endpoint",
    group: "scrapling",
    description: "Streamable HTTP endpoint for the Scrapling MCP server.",
    defaultValue: "",
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
    key: "TZ",
    label: "Timezone (IANA)",
    group: "scrapling",
    description:
      "Server timezone for cron scheduling, logs, and email timestamps (e.g., America/Los_Angeles for PST/PDT).",
    defaultValue: "America/Los_Angeles",
    inputType: "text",
  },
  {
    key: "CRON_ENABLED",
    label: "Enable Daily Cron Job",
    group: "scheduler",
    description:
      "Whether the daily randomized cron job is active (true/false).",
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
      "Random delay added to CRON_BASE_TIME each day (e.g., 60 means a random offset between 0 and 60 minutes).",
    defaultValue: "60",
    inputType: "number",
  },
  {
    key: "EMAIL_ENABLED",
    label: "Enable Email Notifications",
    group: "email",
    description:
      "Enable or disable sending automated email notifications via Resend.",
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
    label: "Notification Sender Email (From)",
    group: "email",
    description:
      "Verified sender address in Resend (e.g. onboarding@resend.dev).",
    defaultValue: "Notifications <onboarding@resend.dev>",
    inputType: "text",
  },
  {
    key: "ALERT_EMAIL_TO",
    label: "Default Recipient Email(s) (To)",
    group: "email",
    description:
      "Default recipient email address(es) for notifications.",
    defaultValue: "",
    inputType: "email",
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
        if (process.env[key] === undefined || key === "TZ") {
          process.env[key] = value;
        }
      }
      break;
    } catch {
      // Ignore unreadable .env files
    }
  }
  if (!process.env.TZ) {
    process.env.TZ = "America/Los_Angeles";
  }
}

/**
 * Reads all environment variables from `.env` merged with `ENV_SCHEMA` and `process.env`.
 */
export function readEnvValues(customPath?: string): Record<string, string> {
  const envPath = resolveEnvFilePath(customPath);
  const fileValues: Record<string, string> = fs.existsSync(envPath)
    ? parseEnvContent(fs.readFileSync(envPath, "utf8"))
    : {};

  const merged: Record<string, string> = {};
  for (const field of ENV_SCHEMA) {
    merged[field.key] =
      fileValues[field.key] ?? process.env[field.key] ?? "";
  }

  for (const [k, v] of Object.entries(fileValues)) {
    merged[k] = v;
  }

  return merged;
}

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
 * Ensures boot `.env` keys (`PORT`, `DATABASE_URL`) exist in the `.env` file without overwriting existing values.
 */
export function ensureDefaultEnvKeys(customPath?: string): void {
  const envPath = resolveEnvFilePath(customPath);
  const existing = fs.existsSync(envPath)
    ? parseEnvContent(fs.readFileSync(envPath, "utf8"))
    : {};

  const missingUpdates: Record<string, string> = {};
  for (const field of ENV_SCHEMA) {
    if (field.envOnly && existing[field.key] === undefined) {
      missingUpdates[field.key] =
        process.env[field.key] ?? field.defaultValue;
    }
  }

  if (Object.keys(missingUpdates).length > 0) {
    updateEnvValues(missingUpdates, envPath);
  }
}
