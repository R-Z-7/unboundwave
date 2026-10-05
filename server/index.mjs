import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as oidc from "openid-client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const app = express(),
  production = process.env.NODE_ENV === "production",
  origin = process.env.APP_ORIGIN || "http://localhost:5173";
if (production && !process.env.SESSION_SECRET)
  throw Error("SESSION_SECRET required");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "wss:"],
      },
    },
  }),
);
app.use(rateLimit({ windowMs: 60000, limit: 80 }));
app.use(express.json({ limit: "64kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 86400000,
    },
  }),
);
const configured = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
let config;
async function google() {
  return (config ||= await oidc.discovery(
    new URL("https://accounts.google.com"),
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  ));
}
app.get("/api/session", (req, res) =>
  res.json({ user: req.session.user || null, googleConfigured: configured }),
);
app.get("/api/auth/google", async (req, res) => {
  if (!configured)
    return res
      .status(503)
      .send(
        "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Use independent identity sign-in, or configure the backend using README.md.",
      );
  try {
    const cfg = await google();
    req.session.verifier = oidc.randomPKCECodeVerifier();
    req.session.state = oidc.randomState();
    req.session.nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(cfg, {
      redirect_uri: origin + "/api/auth/callback",
      scope: "openid",
      code_challenge: await oidc.calculatePKCECodeChallenge(
        req.session.verifier,
      ),
      code_challenge_method: "S256",
      state: req.session.state,
      nonce: req.session.nonce,
    });
    req.session.save(() => res.redirect(url.href));
  } catch {
    res.status(502).send("Sign-in provider unavailable.");
  }
});
app.get("/api/auth/callback", async (req, res) => {
  if (
    !configured ||
    !req.session.verifier ||
    !req.session.state ||
    !req.session.nonce
  )
    return res
      .status(400)
      .send("Sign-in validation failed. Please start again.");
  try {
    const result = await oidc.authorizationCodeGrant(
      await google(),
      new URL(req.originalUrl, origin),
      {
        pkceCodeVerifier: req.session.verifier,
        expectedState: req.session.state,
        expectedNonce: req.session.nonce,
      },
    );
    const claims = result.claims();
    if (!claims?.sub) throw Error();
    req.session.regenerate((err) => {
      if (err) return res.status(500).send("Could not create session.");
      req.session.user = { id: claims.sub };
      req.session.save(() => res.redirect("/?account=connected"));
    });
  } catch {
    res.status(400).send("Sign-in validation failed. Please start again.");
  }
});
app.use("/api/profile", (req, res, next) => {
  if (!req.session.user) return res.sendStatus(401);
  if (req.method !== "GET" && req.get("origin") !== origin)
    return res.sendStatus(403);
  next();
});
const dir = process.env.DATA_DIR || "./data";
await mkdir(dir, { recursive: true });
function path(req) {
  return `${dir}/${Buffer.from(req.session.user.id).toString("hex")}.json`;
}
app.get("/api/profile", async (req, res) => {
  try {
    res.json(JSON.parse(await readFile(path(req), "utf8")));
  } catch {
    res.json({});
  }
});
app.put("/api/profile", async (req, res) => {
  const { displayName, backup } = req.body;
  if (
    typeof displayName !== "string" ||
    displayName.length > 80 ||
    !backup ||
    !Array.isArray(backup.data) ||
    backup.data.length > 10000 ||
    !Array.isArray(backup.salt) ||
    backup.salt.length !== 16 ||
    !Array.isArray(backup.iv) ||
    backup.iv.length !== 12
  )
    return res.sendStatus(400);
  await writeFile(path(req), JSON.stringify({ displayName, backup }), {
    mode: 0o600,
  });
  res.sendStatus(204);
});
app.post("/api/logout", (req, res) => {
  if (req.get("origin") !== origin) return res.sendStatus(403);
  req.session.destroy(() => res.sendStatus(204));
});
app.use(express.static("dist"));
app.get("/{*path}", (req, res) => res.sendFile("index.html", { root: "dist" }));
export { app };
if (process.env.NODE_ENV !== "test")
  app.listen(Number(process.env.PORT || 3001), () =>
    process.stdout.write("Unboundwave backend ready\n"),
  );
