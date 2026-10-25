import { loadEnv } from "./env.js";

loadEnv();

export type ExtractionType = "markdown" | "html" | "text";

export interface ScraplingClientOptions {
  mcpUrl?: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface FetchPageOptions {
  extractionType?: ExtractionType;
  cssSelector?: string | null;
  stealth?: boolean;
  solveCloudflare?: boolean;
  mainContentOnly?: boolean;
}

export type ScraplingFetchOptions = FetchPageOptions;

export interface ScrapedResponse {
  url: string;
  status: number;
  content: string[];
  text: string;
  firstText: string;
  backend: string;
}

export type ScraplingResponse = ScrapedResponse;

interface McpPostResponse {
  sessionId: string | null;
  body: string;
  status: number;
}

export interface McpToolResult {
  url?: string;
  status?: number;
  content?: string[];
  [key: string]: unknown;
}

export interface McpRpcPayload {
  jsonrpc?: string;
  id?: number;
  result?: {
    isError?: boolean;
    structuredContent?: McpToolResult;
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: {
    code?: number;
    message?: string;
  };
}

/**
 * Generic TypeScript client for Scrapling Streamable-HTTP MCP servers.
 * Configured via `SCRAPLING_MCP_URL` (and optional `SCRAPLING_MCP_AUTH_TOKEN`).
 */
export class ScraplingClient {
  public readonly mcpUrl: string;
  public readonly authToken: string;
  public readonly timeoutMs: number;
  private sessionId: string | null = null;
  private requestId = 1;

  constructor(options: ScraplingClientOptions = {}) {
    loadEnv();
    const resolvedUrl =
      options.mcpUrl !== undefined
        ? options.mcpUrl
        : process.env.SCRAPLING_MCP_URL || "";

    if (!resolvedUrl || !resolvedUrl.trim()) {
      throw new Error(
        "Missing Scrapling MCP endpoint URL. Set SCRAPLING_MCP_URL in your local .env file or pass { mcpUrl } to ScraplingClient.",
      );
    }

    this.mcpUrl = resolvedUrl.trim();
    this.authToken =
      options.authToken ?? process.env.SCRAPLING_MCP_AUTH_TOKEN ?? "";
    this.timeoutMs =
      options.timeoutMs ??
      Number.parseInt(process.env.SCRAPLING_TIMEOUT_MS || "60000", 10);
  }

  private async mcpPost(
    payload: Record<string, unknown>,
    sessionId: string | null = null,
  ): Promise<McpPostResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(this.mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const returnedSid = res.headers.get("mcp-session-id");
    const body = await res.text();
    if (!res.ok) {
      throw new Error(
        `Scrapling MCP HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    return {
      sessionId: returnedSid || sessionId,
      body,
      status: res.status,
    };
  }

  public _parseRpcResponse(rawBody: string): McpRpcPayload {
    const trimmed = rawBody.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as McpRpcPayload;
    }

    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter(Boolean);

    if (dataLines.length === 0) {
      throw new Error(
        `Unexpected MCP response from ${this.mcpUrl}: ${trimmed.slice(0, 300)}`,
      );
    }

    return JSON.parse(dataLines[dataLines.length - 1]) as McpRpcPayload;
  }

  public async ensureSession(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId;
    }
    const { sessionId } = await this.mcpPost({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "scrapling-client",
          version: "1.0.0",
        },
      },
    });
    if (!sessionId) {
      throw new Error(`Failed to obtain mcp-session-id from ${this.mcpUrl}`);
    }
    this.sessionId = sessionId;
    return this.sessionId;
  }

  public async callTool(
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    let response: McpPostResponse;
    try {
      const sid = await this.ensureSession();
      response = await this.mcpPost(
        {
          jsonrpc: "2.0",
          id: this.requestId++,
          method: "tools/call",
          params: {
            name: toolName,
            arguments: args,
          },
        },
        sid,
      );
    } catch {
      this.sessionId = null;
      const sid = await this.ensureSession();
      response = await this.mcpPost(
        {
          jsonrpc: "2.0",
          id: this.requestId++,
          method: "tools/call",
          params: {
            name: toolName,
            arguments: args,
          },
        },
        sid,
      );
    }

    const parsed = this._parseRpcResponse(response.body);
    if (parsed.error) {
      throw new Error(
        `Scrapling RPC error (${toolName}): ${JSON.stringify(parsed.error)}`,
      );
    }

    const result = parsed.result || {};
    if (result.isError) {
      const errText =
        result.content?.[0]?.text || "Unknown Scrapling MCP tool error";
      throw new Error(`Scrapling tool error (${toolName}): ${errText}`);
    }
    if (result.structuredContent !== undefined) {
      return result.structuredContent;
    }

    const textItems = (result.content || [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string);
    if (textItems.length > 0) {
      try {
        return JSON.parse(textItems[0]) as McpToolResult;
      } catch {
        return {
          url: typeof args.url === "string" ? args.url : "",
          status: 200,
          content: textItems,
        };
      }
    }

    throw new Error(
      `Unexpected MCP response from ${this.mcpUrl}: ${response.body.slice(0, 300)}`,
    );
  }

  /**
   * Fetch a URL via Scrapling. Uses fast TLS-impersonated `make_request` by default
   * and automatically falls back to headless Chromium (`stealthy_fetch`) if needed.
   */
  public async fetchPage(
    url: string,
    options: FetchPageOptions = {},
  ): Promise<ScrapedResponse> {
    const {
      extractionType = "markdown",
      cssSelector = null,
      stealth = false,
      solveCloudflare = false,
      mainContentOnly = false,
    } = options;

    if (!stealth && !solveCloudflare) {
      const reqArgs: Record<string, unknown> = {
        url,
        extraction_type: extractionType,
        main_content_only: mainContentOnly,
      };
      if (cssSelector) {
        reqArgs.css_selector = cssSelector;
      }

      const res = await this.callTool("make_request", reqArgs);
      const status = Number(res.status || 0);
      const content = Array.isArray(res.content) ? res.content : [];
      if (
        status === 200 &&
        content.some((item) => item && item.trim().length > 0)
      ) {
        const text = content.join("\n");
        return {
          url: typeof res.url === "string" ? res.url : url,
          status,
          content,
          text,
          firstText: content[0] ?? "",
          backend: "mcp:make_request",
        };
      }
    }

    const stealthArgs: Record<string, unknown> = {
      url,
      extraction_type: extractionType,
      headless: true,
      network_idle: true,
      solve_cloudflare: solveCloudflare,
      main_content_only: mainContentOnly,
    };
    if (cssSelector) {
      stealthArgs.css_selector = cssSelector;
    }

    const res = await this.callTool("stealthy_fetch", stealthArgs);
    const content = Array.isArray(res.content) ? res.content : [];
    const text = content.join("\n");
    return {
      url: typeof res.url === "string" ? res.url : url,
      status: Number(res.status || 0),
      content,
      text,
      firstText: content[0] ?? "",
      backend: "mcp:stealthy_fetch",
    };
  }

  /**
   * Fast HTTP request with browser TLS/JA3 fingerprint impersonation.
   */
  public async get(
    url: string,
    options: Omit<FetchPageOptions, "stealth"> = {},
  ): Promise<ScrapedResponse> {
    return this.fetchPage(url, { ...options, stealth: false });
  }

  /**
   * Headless browser fetch with anti-bot stealth and optional Cloudflare solver.
   */
  public async stealthyFetch(
    url: string,
    options: Omit<FetchPageOptions, "stealth"> = {},
  ): Promise<ScrapedResponse> {
    return this.fetchPage(url, { ...options, stealth: true });
  }
}
