import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

function formatTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function createRequestId(): string {
  return randomUUID();
}

export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return requestContext.run({ requestId }, callback);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function withRequestId(message: string): string {
  const requestId = getRequestId();
  const timestamp = `[${formatTimestamp()}]`;
  return requestId ? `${timestamp} [requestId=${requestId.slice(0, 6)}] ${message}` : `${timestamp} ${message}`;
}
