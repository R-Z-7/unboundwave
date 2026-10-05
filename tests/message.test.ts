import { it, expect, vi } from "vitest";
import { accepted, pool, wraps } from "../src/network";
import { generateSecretKey, getPublicKey, nip59 } from "../src/identity";
it("requires relay acknowledgement, and rejects when every relay fails", async () => {
  const event = wraps(
    generateSecretKey(),
    getPublicKey(generateSecretKey()),
    "hello",
  )[0];
  const publish = vi
    .spyOn(pool, "publish")
    .mockReturnValue([
      Promise.reject(Error("no")),
      Promise.resolve("accepted"),
    ]);
  await expect(
    accepted(["wss://one", "wss://two"], event),
  ).resolves.toBeUndefined();
  publish.mockReturnValue([Promise.reject(Error("offline"))]);
  await expect(accepted(["wss://one"], event)).rejects.toThrow();
  await expect(accepted([], event)).rejects.toThrow("No receiving");
  publish.mockRestore();
});
it("a stored retry reuses identical signed event IDs for relay deduplication", () => {
  const a = generateSecretKey(),
    b = generateSecretKey(),
    event = wraps(
      a,
      getPublicKey(b),
      "offline draft",
      undefined,
      1700000000000,
    )[0],
    stored = JSON.parse(JSON.stringify(event));
  expect(stored.id).toBe(event.id);
  expect(nip59.unwrapEvent(stored, b).created_at).toBe(1700000000);
});
