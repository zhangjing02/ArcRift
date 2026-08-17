import pino from "pino";

function isMcpMode(): boolean {
  return (
    process.env.ARCRIFT_MCP_MODE === "true" ||
    process.argv.some((a) => a.includes("mcp") || a.includes("server.js"))
  );
}

const stderrLogger = pino({ level: process.env.LOG_LEVEL || "info" }, pino.destination(2));
const stdoutLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

function getActiveLogger() {
  return isMcpMode() ? stderrLogger : stdoutLogger;
}

export const logger = {
  info: (msg: string, ...args: any[]) => getActiveLogger().info(msg, ...args),
  warn: (msg: string, ...args: any[]) => getActiveLogger().warn(msg, ...args),
  error: (msg: string, ...args: any[]) => getActiveLogger().error(msg, ...args),
  debug: (msg: string, ...args: any[]) => getActiveLogger().debug(msg, ...args),
  success: (msg: string, ...args: any[]) => getActiveLogger().info({ success: true }, msg, ...args),
};
