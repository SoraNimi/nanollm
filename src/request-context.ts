import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

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
  return requestId ? `[requestId=${requestId}] ${message}` : message;
}
