import { generateSecretKey, getPublicKey, nip19, nip59 } from "nostr-tools";
export { generateSecretKey, getPublicKey, nip19, nip59 };
export type Backup = { salt: number[]; iv: number[]; data: number[] };
export async function protect(
  secret: Uint8Array,
  password: string,
): Promise<Backup> {
  if (password.length < 16)
    throw Error("Use a recovery secret of at least 16 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  return {
    salt: [...salt],
    iv: [...iv],
    data: [
      ...new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          new Uint8Array(secret),
        ),
      ),
    ],
  };
}
async function derive(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 600000,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function unlock(backup: Backup, password: string) {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(backup.iv) },
      await derive(password, new Uint8Array(backup.salt)),
      new Uint8Array(backup.data),
    ),
  );
}
export function publicKey(value: string): string {
  if (/^[0-9a-f]{64}$/.test(value)) return value;
  const d = nip19.decode(value.replace("nostr:", ""));
  if (d.type !== "npub") throw Error("Enter a valid npub identity.");
  return d.data;
}
