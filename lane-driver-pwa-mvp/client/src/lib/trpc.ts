import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { getLearnerId } from "./learner";

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: () => ({ "x-lane-learner": getLearnerId() }),
      }),
    ],
  });
}

export const tzOffsetMinutes = () => new Date().getTimezoneOffset();
