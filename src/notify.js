// Unsubscribe links from emails sent before notifications were retired still work.

const enc = new TextEncoder();
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkUnsubscribe(secret, uid, sig) {
  return !!uid && !!sig && (await hmac(secret, "unsub:" + uid)).slice(0, 32) === sig;
}
