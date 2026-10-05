import { beforeAll, afterAll, it, expect } from "vitest";
let server, url;
beforeAll(async () => {
  const { app } = await import("../server/index.mjs");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
it("does not disclose Google email or issue a session for an anonymous visitor", async () => {
  const res = await fetch(url + "/api/session");
  expect(await res.json()).toEqual({ user: null, googleConfigured: false });
  expect(res.headers.get("set-cookie")).toBeNull();
});
it("requires an authenticated account for profile access", async () => {
  expect((await fetch(url + "/api/profile")).status).toBe(401);
  expect(
    (
      await fetch(url + "/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Attacker", backup: {} }),
      })
    ).status,
  ).toBe(401);
});
it("rejects a forged OAuth callback without starting a session", async () => {
  const res = await fetch(url + "/api/auth/callback?code=forged&state=forged");
  expect(res.status).toBe(400);
  expect(res.headers.get("set-cookie")).toBeNull();
});
it("clearly reports Google configuration required", async () => {
  expect((await fetch(url + "/api/auth/google")).status).toBe(503);
});
it("rejects cross-origin logout requests", async () => {
  expect(
    (
      await fetch(url + "/api/logout", {
        method: "POST",
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
  ).toBe(403);
});
