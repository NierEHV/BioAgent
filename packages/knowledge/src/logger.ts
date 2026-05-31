import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

const rootLogger = pino({
  level,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

export function getLogger(name: string) {
  return rootLogger.child({ module: name });
}

export { rootLogger as logger };
