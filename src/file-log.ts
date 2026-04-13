import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getRequestId } from "./request-context.js";

const MAX_LOG_STRING_LENGTH = 4000;
const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|x-api-key/i;

function getLogDirectory(): string {
  return resolve(process.cwd(), process.env.NANOLLM_LOG_DIR || "logs");
}

function getLogDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}${month}${day}-${hour}`;
}

export function getGatewayLogPath(date = new Date()): string {
  return resolve(getLogDirectory(), `nanollm-${getLogDate(date)}.jsonl`);
}

function truncateString(value: string): string {
  if (value.length <= MAX_LOG_STRING_LENGTH) return value;
  const head = value.slice(0, 3000);
  const tail = value.slice(-500);
  return `${head}<...truncated length=${value.length - head.length - tail.length}...>${tail}`;
}

function sanitizeForLog(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string") {
    if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey)) return "***REDACTED***";
    return truncateString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, sanitizeForLog(child, key)]),
    );
  }

  return value;
}

export function writeGatewayLog(event: string, payload: Record<string, unknown>): void {
  const now = new Date();
  const logPath = getGatewayLogPath(now);
  mkdirSync(dirname(logPath), { recursive: true });

  const line = JSON.stringify({
    ts: now.toISOString(),
    requestId: getRequestId() ?? null,
    event,
    payload: sanitizeForLog(payload),
  });

  appendFileSync(logPath, `${line}\n`, "utf8");
}
