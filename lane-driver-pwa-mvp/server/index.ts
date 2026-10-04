import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { getDb } from "./handler.js";
import { appRouter } from "./routers.js";
import { createContext, LEARNER_HEADER } from "./trpc.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  await getDb(); // fail fast on a bad database config
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: async ({ req }) => createContext(await getDb(), req.headers[LEARNER_HEADER]),
    }),
  );

  // Optional self-hosted lesson clips (see README): served before the SPA fallback so a
  // missing file is a real 404 and the player falls back to the Drive embed.
  const videosDir = path.resolve(projectRoot, isProduction ? "dist/public/videos" : "client/public/videos");
  app.use("/videos", express.static(videosDir, { fallthrough: false }));

  if (isProduction) {
    const publicDir = path.resolve(projectRoot, "dist/public");
    app.use(express.static(publicDir, { index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.resolve(projectRoot, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.get(/^(?!\/api\/).*/, async (req, res, next) => {
      try {
        const template = fs.readFileSync(path.resolve(projectRoot, "client/index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  app.listen(port, () => {
    console.log(`Lane running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
