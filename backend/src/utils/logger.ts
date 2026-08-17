import pino from "pino";

function isMcpMode(): boolean {
  return (
    process.env.ARCRIFT_MCP_MODE === "true" ||
    process.argv.some((a) => a.includes("mcp") || a.includes("server.js"))
  );
}

let activeLogger: any;
try {
  activeLogger = isMcpMode()
    ? pino({ level: process.env.LOG_LEVEL || "info" }, pino.destination({ fd: 2, sync: true }))
    : pino({
        level: process.env.LOG_LEVEL || "info",
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      });
} catch {
  activeLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

export const logger = {
  info: (msg: string, ...args: any[]) => {
    try { activeLogger.info(msg, ...args); } catch {}
  },
  warn: (msg: string, ...args: any[]) => {
    try { activeLogger.warn(msg, ...args); } catch {}
  },
  error: (msg: string, ...args: any[]) => {
    try { activeLogger.error(msg, ...args); } catch {}
  },
  debug: (msg: string, ...args: any[]) => {
    try { activeLogger.debug(msg, ...args); } catch {}
  },
  success: (msg: string, ...args: any[]) => {
    try { activeLogger.info({ success: true }, msg, ...args); } catch {}
  },
};
