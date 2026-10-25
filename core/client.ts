import { loadEnv } from "./env.js";

loadEnv();

export type ExtractionType = "markdown" | "html" | "text";
export type WaitSelectorState = "attached" | "detached" | "hidden" | "visible";

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
  /** CSS selector to wait for in browser modes before extracting content */
  waitSelector?: string | null;
  waitSelectorState?: WaitSelectorState;
  /** Extra time in ms to wait after page load finishes in browser modes */
  waitMs?: number;
  /** Wait until network has no active connections for 500ms */
  networkIdle?: boolean;
  /** Drop heavy font/image/media requests for faster browser loads */
  disableResources?: boolean;
  /** Add random canvas fingerprint noise in stealth mode */
  hideCanvas?: boolean;
  /** Prevent WebRTC local IP leak in stealth mode */
  blockWebrtc?: boolean;
  /** Spoof Google Search referer header (default: true) */
  googleSearch?: boolean;
  /** Browser fingerprint(s) to impersonate in HTTP mode */
  impersonate?: string | string[];
  /** Number of HTTP-level retries (default: 3) */
  retries?: number;
  /** Seconds between HTTP-level retries (default: 1) */
  retryDelay?: number;
  /** Per-request timeout in ms for browser operations */
  pageTimeoutMs?: number;
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
  result?: Array<{ url?: string; status?: number; content?: string[] }>;
  session_id?: string;
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

const ANTI_BOT_PATTERNS = [
  /just a moment\.\.\./i,
  /attention required!\s*\|\s*cloudflare/i,
  /cf-browser-verification/i,
  /verify you are human/i,
  /access denied/i,
  /ddos-guard/i,
];

/**
 * Checks whether a response appears to be blocked by a WAF/Cloudflare interstitial or empty.
 */
export function isBlockedOrEmptyResponse(
  status: number,
  content: string[],
): boolean {
  if (status === 403 || status === 429 || status === 503 || status === 0) {
    return true;
  }
  const nonEmpty = content.filter((item) => item && item.trim().length > 0);
  if (nonEmpty.length === 0) {
    return true;
  }
  const combined = nonEmpty.join("\n");
  if (combined.length < 500) {
    for (const pattern of ANTI_BOT_PATTERNS) {
      if (pattern.test(combined)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Generic TypeScript client for Scrapling Streamable-HTTP MCP servers.
 * Implements Scrapling's multi-tier anti-bot escalation:
 *   Tier 1: Fast HTTP with TLS/JA3 fingerprint impersonation + retries (`make_request`)
 *   Tier 2: Stealth headless browser with `wait_selector`, `network_idle`, and `hide_canvas` (`stealthy_fetch`)
 *   Tier 3: Stealth headless browser with automatic Cloudflare Turnstile/interstitial solver (`solve_cloudflare: true`)
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
      Number.parseInt(process.env.SCRAPLING_TIMEOUT_MS || "90000", 10);
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
   * Fetch a URL via Scrapling with automatic multi-tier escalation when a page is blocked or empty:
   * - Tier 1: `make_request` (TLS fingerprint impersonation + stealthy headers + retries)
   * - Tier 2: `stealthy_fetch` (Playwright/Camoufox stealth browser + `wait_selector` + `network_idle` + `hide_canvas`)
   * - Tier 3: `stealthy_fetch` with `solve_cloudflare: true` and extended wait time
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
      waitSelector = null,
      waitSelectorState = "attached",
      waitMs = 0,
      networkIdle = true,
      disableResources = false,
      hideCanvas = true,
      blockWebrtc = true,
      googleSearch = true,
      impersonate = ["chrome", "chrome136", "firefox", "safari"],
      retries = 3,
      retryDelay = 1,
      pageTimeoutMs = 45000,
    } = options;

    // Tier 1: Fast HTTP request with TLS impersonation (unless stealth/waitSelector/solveCloudflare requested)
    if (!stealth && !solveCloudflare && !waitSelector) {
      try {
        const reqArgs: Record<string, unknown> = {
          url,
          extraction_type: extractionType,
          main_content_only: mainContentOnly,
          impersonate,
          stealthy_headers: true,
          retries,
          retry_delay: retryDelay,
        };
        if (cssSelector) {
          reqArgs.css_selector = cssSelector;
        }

        const res = await this.callTool("make_request", reqArgs);
        const status = Number(res.status || 0);
        const content = Array.isArray(res.content) ? res.content : [];
        if (!isBlockedOrEmptyResponse(status, content)) {
          return {
            url: typeof res.url === "string" ? res.url : url,
            status,
            content,
            text: content.join("\n"),
            firstText: content[0] ?? "",
            backend: "mcp:make_request",
          };
        }
      } catch {
        // Escalate to Tier 2 (stealthy_fetch) on HTTP failure
      }
    }

    // Tier 2: Stealth headless browser fetch
    const buildStealthArgs = (
      cfSolve: boolean,
      extraWaitMs: number,
      includeWaitSelector: boolean,
    ): Record<string, unknown> => {
      const args: Record<string, unknown> = {
        url,
        extraction_type: extractionType,
        headless: true,
        network_idle: networkIdle,
        solve_cloudflare: cfSolve,
        main_content_only: mainContentOnly,
        google_search: googleSearch,
        hide_canvas: hideCanvas,
        block_webrtc: blockWebrtc,
        allow_webgl: true,
        disable_resources: disableResources,
        timeout: pageTimeoutMs,
        wait: waitMs + extraWaitMs,
      };
      if (cssSelector) {
        args.css_selector = cssSelector;
      }
      if (includeWaitSelector && waitSelector) {
        args.wait_selector = waitSelector;
        args.wait_selector_state = waitSelectorState;
      }
      return args;
    };

    try {
      const res = await this.callTool(
        "stealthy_fetch",
        buildStealthArgs(solveCloudflare, 0, true),
      );
      const status = Number(res.status || 0);
      const content = Array.isArray(res.content) ? res.content : [];
      if (!isBlockedOrEmptyResponse(status, content)) {
        return {
          url: typeof res.url === "string" ? res.url : url,
          status,
          content,
          text: content.join("\n"),
          firstText: content[0] ?? "",
          backend: "mcp:stealthy_fetch",
        };
      }
    } catch {
      // Escalate to Tier 3 if wait_selector timed out or stealthy_fetch failed
    }

    // Tier 3: Fallback with solve_cloudflare=true, extended wait time, and without strict wait_selector timeout
    const res = await this.callTool(
      "stealthy_fetch",
      buildStealthArgs(true, 2000, false),
    );
    const content = Array.isArray(res.content) ? res.content : [];
    return {
      url: typeof res.url === "string" ? res.url : url,
      status: Number(res.status || 0),
      content,
      text: content.join("\n"),
      firstText: content[0] ?? "",
      backend: "mcp:stealthy_fetch:cloudflare_fallback",
    };
  }

  /**
   * Fast HTTP request with browser TLS/JA3 fingerprint impersonation (automatically escalates to stealthy_fetch if blocked).
   */
  public async get(
    url: string,
    options: Omit<FetchPageOptions, "stealth"> = {},
  ): Promise<ScrapedResponse> {
    return this.fetchPage(url, { ...options, stealth: false });
  }

  /**
   * Headless browser fetch with anti-bot stealth, optional `waitSelector`, and Cloudflare solver fallback.
   */
  public async stealthyFetch(
    url: string,
    options: Omit<FetchPageOptions, "stealth"> = {},
  ): Promise<ScrapedResponse> {
    return this.fetchPage(url, { ...options, stealth: true });
  }
}
