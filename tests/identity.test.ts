import { describe, it, expect } from "vitest";
import {
  generateSecretKey,
  getPublicKey,
  protect,
  unlock,
  nip59,
  publicKey,
  nip19,
} from "../src/identity";
import { wraps } from "../src/network";
import { verifyEvent } from "nostr-tools";
describe("identity and recovery", () => {
  it("roundtrips a protected backup using only the independent recovery secret", async () => {
    const sk = generateSecretKey(),
      b = await protect(sk, "independent-recovery-secret");
    expect(await unlock(b, "independent-recovery-secret")).toEqual(sk);
    await expect(unlock(b, "google-account-token")).rejects.toThrow();
    expect(JSON.stringify(b)).not.toContain(nip19.nsecEncode(sk));
  });
  it("rejects a short recovery secret", async () => {
    await expect(protect(generateSecretKey(), "short")).rejects.toThrow();
  });
  it("validates public identity formats", () => {
    const pub = getPublicKey(generateSecretKey());
    expect(publicKey(nip19.npubEncode(pub))).toBe(pub);
    expect(() => publicKey("user@example.com")).toThrow();
  });
});
describe("NIP-17 messaging", () => {
  it("produces separate authenticated recipient and sender wraps of the same rumor", () => {
    const a = generateSecretKey(),
      b = generateSecretKey();
    const events = wraps(a, getPublicKey(b), "private message");
    expect(events.every(verifyEvent)).toBe(true);
    expect(events[0].content).not.toContain("private message");
    const received = nip59.unwrapEvent(events[0], b),
      sent = nip59.unwrapEvent(events[1], a);
    expect(received.id).toBe(sent.id);
    expect(received.pubkey).toBe(getPublicKey(a));
    expect(received.kind).toBe(14);
    expect(received.content).toBe("private message");
    expect(() => nip59.unwrapEvent(events[0], generateSecretKey())).toThrow();
  });
  it("preserves reply references", () => {
    const a = generateSecretKey(),
      b = generateSecretKey();
    const ev = wraps(a, getPublicKey(b), "reply", "parent-id");
    expect(nip59.unwrapEvent(ev[0], b).tags).toContainEqual(["e", "parent-id"]);
  });
  it("rejects tampered ciphertext", () => {
    const a = generateSecretKey(),
      b = generateSecretKey();
    const ev = wraps(a, getPublicKey(b), "test")[0];
    ev.content = ev.content.slice(0, -4) + "AAAA";
    expect(() => nip59.unwrapEvent(ev, b)).toThrow();
  });
});
