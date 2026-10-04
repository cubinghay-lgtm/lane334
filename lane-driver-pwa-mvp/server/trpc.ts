import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ensureLearner, type Db } from "./db.js";

export const LEARNER_HEADER = "x-lane-learner";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface Context {
  db: Db;
  learnerId: string | null;
}

/** Learners are anonymous: a random device UUID sent as a header, never a name or email. */
export function createContext(db: Db, headerValue: string | string[] | undefined | null): Context {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return { db, learnerId: raw && UUID.test(raw) ? raw.toLowerCase() : null };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const learnerProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.learnerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing learner id" });
  await ensureLearner(ctx.db, ctx.learnerId);
  return next({ ctx: { ...ctx, learnerId: ctx.learnerId } });
});
