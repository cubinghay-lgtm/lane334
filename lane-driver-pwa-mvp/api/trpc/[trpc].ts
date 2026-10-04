// Vercel serverless function: every /api/trpc/* call lands here.
import { handleTrpcRequest } from "../../server/handler.js";

export const GET = handleTrpcRequest;
export const POST = handleTrpcRequest;
