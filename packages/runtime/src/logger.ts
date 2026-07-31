export const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

type MessageLevel = Exclude<LogLevel, "silent">;

const RANK: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

export interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  child(prefix: string): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  sink?: (line: string) => void;
}

function writeToStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const threshold = RANK[options.level ?? "info"];
  const sink = options.sink ?? writeToStderr;

  const emit =
    (level: MessageLevel, prefix: string) =>
    (message: string): void => {
      if (RANK[level] > threshold) return;
      sink(prefix === "" ? message : `${prefix}${message}`);
    };

  const build = (prefix: string): Logger => ({
    error: emit("error", prefix),
    warn: emit("warn", prefix),
    info: emit("info", prefix),
    debug: emit("debug", prefix),
    child: (next) => build(`${prefix}${next}`),
  });

  return build("");
}

export interface MemoryLogger extends Logger {
  readonly lines: string[];
}

export function createMemoryLogger(level: LogLevel = "debug"): MemoryLogger {
  const lines: string[] = [];
  return Object.assign(createLogger({ level, sink: (line) => lines.push(line) }), { lines });
}

export const SILENT_LOGGER: Logger = createLogger({ level: "silent", sink: () => {} });
