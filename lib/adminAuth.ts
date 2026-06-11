// Web Crypto API - kompatybilne z Cloudflare Pages (edge runtime)
const enc = new TextEncoder();

function secret() {
  return process.env.ADMIN_SECRET || "dev-secret";
}

async function hmacHex(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSession(): Promise<string> {
  const payload = `admin.${Date.now() + 1000 * 60 * 60 * 12}`; // 12h
  return `${payload}.${await hmacHex(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await hmacHex(payload);
  if (!safeEqual(expected, parts[2])) return false;
  return Number(parts[1]) > Date.now();
}

export const ADMIN_COOKIE = "bp_admin";
