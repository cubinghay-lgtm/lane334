import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Outputs = inferRouterOutputs<AppRouter>;
type Inputs = inferRouterInputs<AppRouter>;

export type ProgressSummary = Outputs["progress"]["summary"];
export type TopicProgress = ProgressSummary["topics"][number];
export type Readiness = ProgressSummary["readiness"];
export type InteractionPayload = Inputs["learning"]["recordInteraction"];
export type InteractionOutcome = Outputs["learning"]["recordInteraction"];
export type CommunityPost = Outputs["community"]["list"][number];
