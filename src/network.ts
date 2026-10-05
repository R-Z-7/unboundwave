import {
  SimplePool,
  finalizeEvent,
  getPublicKey,
  nip59,
  type Event,
} from "nostr-tools";
export const defaults = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];
export const pool = new SimplePool();
export async function accepted(relays: string[], event: Event) {
  if (!relays.length) throw Error("No receiving relays advertised.");
  await Promise.any(pool.publish(relays, event));
}
export async function inboxRelays(pubkey: string, relays: string[]) {
  const events = await pool.querySync(relays, {
    kinds: [10050],
    authors: [pubkey],
  });
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
  return (
    latest?.tags
      .filter((t) => t[0] === "relay" && t[1]?.startsWith("wss://"))
      .map((t) => t[1]) || []
  );
}
export async function announce(secret: Uint8Array, relays: string[]) {
  await accepted(
    relays,
    finalizeEvent(
      {
        kind: 10050,
        content: "",
        tags: relays.map((r) => ["relay", r]),
        created_at: Math.floor(Date.now() / 1000),
      },
      secret,
    ),
  );
}
export function wraps(
  secret: Uint8Array,
  recipient: string,
  content: string,
  reply?: string,
  time = Date.now(),
) {
  const template = {
    kind: 14,
    created_at: Math.floor(time / 1000),
    content,
    tags: [["p", recipient], ...(reply ? [["e", reply]] : [])],
  };
  return [
    nip59.wrapEvent(template, secret, recipient),
    nip59.wrapEvent(template, secret, getPublicKey(secret)),
  ];
}
