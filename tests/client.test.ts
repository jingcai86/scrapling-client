import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ScraplingClient, loadEnv } from "../core/index.js";

describe("ScraplingClient & loadEnv", () => {
  it("loads variables from a .env file without overriding existing env vars", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrapling-env-"));
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(
      envFile,
      [
        "# Example comment",
        "TEST_SCRAPLING_VAR_A=http://localhost:9999/mcp",
        'TEST_SCRAPLING_VAR_B="quoted-value"',
      ].join("\n"),
      "utf8",
    );

    delete process.env.TEST_SCRAPLING_VAR_A;
    process.env.TEST_SCRAPLING_VAR_B = "already-set";

    loadEnv(envFile);

    assert.equal(process.env.TEST_SCRAPLING_VAR_A, "http://localhost:9999/mcp");
    assert.equal(process.env.TEST_SCRAPLING_VAR_B, "already-set");

    delete process.env.TEST_SCRAPLING_VAR_A;
    delete process.env.TEST_SCRAPLING_VAR_B;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws an explicit error if SCRAPLING_MCP_URL is missing", () => {
    const original = process.env.SCRAPLING_MCP_URL;
    delete process.env.SCRAPLING_MCP_URL;
    try {
      assert.throws(
        () => new ScraplingClient({ mcpUrl: "" }),
        /Missing Scrapling MCP endpoint URL/,
      );
    } finally {
      if (original !== undefined) {
        process.env.SCRAPLING_MCP_URL = original;
      }
    }
  });

  it("parses SSE data lines from MCP streamable HTTP responses", () => {
    const client = new ScraplingClient({ mcpUrl: "http://localhost:8000/mcp" });
    const rawSse = [
      "event: message",
      'data: {"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"status":200,"content":["hello"],"url":"https://example.com"}}}',
      "",
    ].join("\n");

    const parsed = client._parseRpcResponse(rawSse);
    assert.equal(parsed.result?.structuredContent?.status, 200);
    assert.deepEqual(parsed.result?.structuredContent?.content, ["hello"]);
  });
});
