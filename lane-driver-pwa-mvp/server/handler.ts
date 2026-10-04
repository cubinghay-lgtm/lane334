import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createDb, type Db } from "./db.js";
import { appRouter } from "./routers.js";
import { createContext, LEARNER_HEADER } from "./trpc.js";

let dbPromise: Promise<Db> | null = null;

/** One database connection per server instance, opened (and migrated) on first use. */
export function getDb(): Promise<Db> {
  dbPromise ??= createDb().catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** Web-standard tRPC handler, used by the Vercel function in api/trpc/[trpc].ts. */
export function handleTrpcRequest(request: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => createContext(await getDb(), request.headers.get(LEARNER_HEADER)),
  });
}
