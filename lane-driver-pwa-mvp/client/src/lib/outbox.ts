import { TRPCClientError } from "@trpc/client";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Inputs = inferRouterInputs<AppRouter>["learning"];

export type OutboxItem =
  | { kind: "recordInteraction"; input: Inputs["recordInteraction"] }
  | { kind: "reviewLater"; input: Inputs["reviewLater"] }
  | { kind: "skip"; input: Inputs["skip"] };

const KEY = "lane.outbox.v1";

function read(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode): the interaction is lost, progress still works online.
  }
}

/** True when the request never reached the server (offline, DNS, timeout). */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TRPCClientError && !error.data;
}

export function enqueue(item: OutboxItem) {
  write([...read(), item]);
}

export function pendingCount() {
  return read().length;
}

/** Replays queued learning events in order; stops at the first network failure. */
export async function flushOutbox(send: (item: OutboxItem) => Promise<unknown>): Promise<number> {
  const items = read();
  let sent = 0;
  for (const item of items) {
    try {
      await send(item);
    } catch (error) {
      if (isNetworkError(error)) break;
      // The server rejected it (e.g. curriculum changed); drop it rather than retry forever.
    }
    sent++;
  }
  write(items.slice(sent));
  return sent;
}
