const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerOptions {
  /** Whether to suppress all progress output */
  silent?: boolean;
}

/**
 * Lightweight terminal spinner & progress indicator that writes to `stderr`
 * so `stdout` (such as `--json` output) remains completely clean.
 */
export class TerminalSpinner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private frameIdx = 0;
  private startTime = 0;
  private currentText = "";
  private readonly silent: boolean;
  private readonly isTty: boolean;

  constructor(options: SpinnerOptions = {}) {
    this.silent = Boolean(options.silent);
    this.isTty = Boolean(process.stderr.isTTY);
  }

  public start(text: string): void {
    if (this.silent) return;
    this.stop();
    this.currentText = text;
    this.startTime = Date.now();
    this.frameIdx = 0;

    if (!this.isTty) {
      process.stderr.write(`⏳ ${text}\n`);
      return;
    }

    this.render();
    this.timer = setInterval(() => {
      this.render();
    }, 80);
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  public update(text: string): void {
    if (this.silent) return;
    this.currentText = text;
    if (!this.isTty) {
      process.stderr.write(`⏳ ${text}\n`);
    } else {
      this.render();
    }
  }

  public succeed(text?: string): void {
    if (this.silent) return;
    const elapsed = this.getElapsedSeconds();
    const finalMsg = text ?? this.currentText;
    this.clearLine();
    this.stopTimer();
    if (finalMsg) {
      process.stderr.write(`✔ ${finalMsg} (${elapsed}s)\n`);
    }
  }

  public warn(text: string): void {
    if (this.silent) return;
    const elapsed = this.getElapsedSeconds();
    this.clearLine();
    this.stopTimer();
    process.stderr.write(`⚠ ${text} (${elapsed}s)\n`);
  }

  public stop(): void {
    if (this.silent) return;
    this.clearLine();
    this.stopTimer();
  }

  private getElapsedSeconds(): string {
    if (!this.startTime) return "0.0";
    return ((Date.now() - this.startTime) / 1000).toFixed(1);
  }

  private render(): void {
    const frame = SPINNER_FRAMES[this.frameIdx % SPINNER_FRAMES.length];
    this.frameIdx++;
    const elapsed = this.getElapsedSeconds();
    const line = `\r\x1b[K${frame} ${this.currentText} (${elapsed}s)`;
    process.stderr.write(line);
  }

  private clearLine(): void {
    if (this.isTty && this.timer) {
      process.stderr.write("\r\x1b[K");
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Runs an async task with a live terminal spinner on `stderr`.
 */
export async function withSpinner<T>(
  text: string,
  task: (spinner: TerminalSpinner) => Promise<T>,
  options: {
    silent?: boolean;
    successText?: (result: T) => string;
  } = {},
): Promise<T> {
  const spinner = new TerminalSpinner({ silent: options.silent });
  spinner.start(text);
  try {
    const result = await task(spinner);
    const doneMsg = options.successText ? options.successText(result) : text;
    spinner.succeed(doneMsg);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.warn(`${text} — failed: ${msg}`);
    throw err;
  }
}
