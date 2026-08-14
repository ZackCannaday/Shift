import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { EMBED_SCRIPT } from "./lib/embed-script";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Only the public embed API is cross-origin. Dashboard/session APIs remain
// same-origin so credentialed requests are never reflected to arbitrary sites.
app.use("/api/embed", cors({ origin: true, credentials: false }));

// Serve the embeddable script at the root level (not under /api)
app.get(["/shift.js", "/api/shift.js"], (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(EMBED_SCRIPT);
});

app.use("/api", router);

export default app;
