import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

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
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
      break;
    } catch {
      // Ignore unreadable .env files
    }
  }
}
