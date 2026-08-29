import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { EMBED_SCRIPT } from "./lib/embed-script";

const app: Express = express();

// # Proxy boundary
export function parseTrustProxySetting(rawValue?: string): false | string {
  const value = rawValue?.trim();
  if (!value || value === "false") return false;
  if (value === "true" || /^\d+$/.test(value)) {
    throw new Error(
      "SHIFT_TRUST_PROXY must be an exact IP, CIDR, or named subnet list; broad trust is not allowed",
    );
  }
  return value;
}

const trustProxySetting = parseTrustProxySetting(process.env.SHIFT_TRUST_PROXY);
try {
  app.set("trust proxy", trustProxySetting);
} catch (error) {
  throw new Error(
    "SHIFT_TRUST_PROXY contains an invalid proxy address or subnet",
    { cause: error },
  );
}
app.disable("x-powered-by");

// # Response security
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

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

// # Request parsing
app.use(express.json({ limit: "32kb" }));
app.use(
  express.urlencoded({ extended: true, limit: "16kb", parameterLimit: 100 }),
);
app.use(cookieParser());

// # Auth mutation guard
function requestOrigin(req: Request): string | null {
  const configuredUrl = process.env.PUBLIC_APP_URL;
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      return null;
    }
  }

  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : null;
}

export function guardAuthenticatedMutation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const changesState = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const hasDashboardSession = typeof req.cookies?.shift_session === "string";
  if (!changesState || !hasDashboardSession) {
    next();
    return;
  }

  const expectedOrigin = requestOrigin(req);
  const origin = req.get("origin");
  const fetchSite = req.get("sec-fetch-site");
  if (
    !expectedOrigin ||
    origin !== expectedOrigin ||
    fetchSite === "cross-site"
  ) {
    res
      .status(403)
      .json({ error: "Cross-origin authenticated request rejected" });
    return;
  }

  next();
}

app.use(["/api/auth", "/api/settings"], (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", guardAuthenticatedMutation);

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

// # Parser errors
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  const parserError = error as { status?: number; type?: string };
  if (parserError.status === 413 || parserError.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  next(error);
});

export default app;
