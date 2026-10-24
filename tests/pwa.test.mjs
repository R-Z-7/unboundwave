import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const template = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
function worker({ failInstall = false } = {}) {
  const listeners = {};
  const entries = new Map();
  const cache = {
    addAll: vi.fn(async (urls) => {
      if (failInstall) throw Error("Missing bundle");
      for (const url of urls) entries.set(url, new Response(url));
    }),
    match: vi.fn(async (url) => entries.get(url)?.clone()),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: async () => ["unboundwave-shell-old", "unboundwave-shell-test", "other-app"],
    delete: vi.fn(async () => true),
  };
  const claim = vi.fn(async () => {});
  const fetch = vi.fn(async () => new Response("network"));
  runInNewContext(template.replace("__BUILD_ID__", "test").replace(
    "__PRECACHE_URLS__", JSON.stringify(["/index.html", "/assets/app.js", "/assets/app.css"])), {
    self: { location: { origin: "https://app.test" }, clients: { claim },
      addEventListener: (name, handler) => { listeners[name] = handler; } },
    URL, caches, fetch,
  });
  const lifecycle = async (name) => {
    let pending;
    listeners[name]({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  };
  const request = (path, mode = "cors", method = "GET") => {
    let response;
    listeners.fetch({ request: { url: new URL(path, "https://app.test").href, mode, method },
      respondWith: (promise) => { response = promise; } });
    return response;
  };
  return { cache, caches, fetch, claim, lifecycle, request };
}

describe("PWA release cache", () => {
  it("installs all assets and serves the same release without network access", async () => {
    const sw = worker();
    await sw.lifecycle("install");
    expect(sw.cache.addAll).toHaveBeenCalledWith(["/index.html", "/assets/app.js", "/assets/app.css"]);
    expect(await (await sw.request("/?contact=friend", "navigate")).text()).toBe("/index.html");
    expect(await (await sw.request("/assets/app.js")).text()).toBe("/assets/app.js");
    expect(await (await sw.request("/assets/app.css?v=1")).text()).toBe("/assets/app.css");
    expect(sw.fetch).not.toHaveBeenCalled();
  });
  it("fails installation when a release asset is missing", async () => {
    const sw = worker({ failInstall: true });
    await expect(sw.lifecycle("install")).rejects.toThrow("Missing bundle");
    expect(sw.claim).not.toHaveBeenCalled();
  });
  it("never intercepts APIs, auth navigations, writes or external resources", () => {
    const sw = worker();
    for (const path of ["/api", "/api/session", "/api/profile", "/api/auth/callback?code=private", "https://relay.test/event", "/unlisted.json"])
      expect(sw.request(path, path.includes("callback") ? "navigate" : "cors")).toBeUndefined();
    expect(sw.request("/index.html", "navigate", "POST")).toBeUndefined();
  });
  it("removes only obsolete Unboundwave shell caches on activation", async () => {
    const sw = worker();
    await sw.lifecycle("activate");
    expect(sw.caches.delete.mock.calls).toEqual([["unboundwave-shell-old"]]);
    expect(sw.claim).toHaveBeenCalledOnce();
  });
});
