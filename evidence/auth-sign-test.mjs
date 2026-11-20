/* Deterministic self-test of the request-signing rules in
 * https://docs.kalshi.com/getting_started/api_keys
 *   pre-sign text = timestamp + METHOD + path   (path WITHOUT query string)
 *   RSA keys  -> RSA-PSS/SHA-256, MGF1-SHA256, salt length = digest length (32)
 *   Ed25519   -> sign the message directly
 *   private key PEM is PKCS#8 ("-----BEGIN PRIVATE KEY-----"), NOT SPKI
 * No network, no credentials: uses a key pair generated locally.
 */
import crypto from "node:crypto";

const { subtle } = crypto.webcrypto;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); };

const b64url = b => Buffer.from(b).toString("base64");

// ---- RSA (PKCS#8) ----
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs8Pem = privateKey.export({ type: "pkcs8", format: "pem" });
const spkiPemPriv = privateKey.export({ type: "pkcs1", format: "pem" });
const pubPem = publicKey.export({ type: "spki", format: "pem" });

const der = pem => Uint8Array.from(Buffer.from(
  pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, ""), "base64"));

// 1. Importing a PRIVATE key as "spki" must fail (this is what a common mistake does).
let spkiImportFailed = false;
try {
  await subtle.importKey("spki", der(pkcs8Pem), { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
} catch { spkiImportFailed = true; }
check('RSA private key imported as "spki" is rejected', spkiImportFailed);

// 2. Importing as "pkcs8" must succeed.
let pkcs8Key = null;
try {
  pkcs8Key = await subtle.importKey("pkcs8", der(pkcs8Pem), { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
} catch (e) { check("pkcs8 import error: " + e.message, false); }
check('RSA private key imported as "pkcs8" succeeds', !!pkcs8Key);

// 3. Signature must verify only over the full path including /trade-api/v2.
const ts = String(Date.now());
const METHOD = "GET";
const fullPath = "/trade-api/v2/portfolio/balance";
const shortPath = "/portfolio/balance"; // what the pre-existing site signed
const msgFull = new TextEncoder().encode(ts + METHOD + fullPath);
const msgShort = new TextEncoder().encode(ts + METHOD + shortPath);

const sig = Buffer.from(await subtle.sign({ name: "RSA-PSS", saltLength: 32 }, pkcs8Key, msgFull));
const pubKey = await subtle.importKey("spki", der(pubPem), { name: "RSA-PSS", hash: "SHA-256" }, false, ["verify"]);
const verifiesFull = await subtle.verify({ name: "RSA-PSS", saltLength: 32 }, pubKey, sig, msgFull);
const verifiesShort = await subtle.verify({ name: "RSA-PSS", saltLength: 32 }, pubKey, sig, msgShort);
check("signature verifies against timestamp+METHOD+/trade-api/v2/portfolio/balance", verifiesFull);
check("same signature does NOT verify against timestamp+METHOD+/portfolio/balance",
      verifiesFull && !verifiesShort);

// 4. Query string must be excluded from the signed path.
const withQuery = "/trade-api/v2/portfolio/fills?limit=5";
const stripped = withQuery.split("?")[0];
const msgStripped = new TextEncoder().encode(ts + METHOD + stripped);
const sig2 = Buffer.from(await subtle.sign({ name: "RSA-PSS", saltLength: 32 }, pkcs8Key, msgStripped));
const v2a = await subtle.verify({ name: "RSA-PSS", saltLength: 32 }, pubKey, sig2, msgStripped);
const v2b = await subtle.verify({ name: "RSA-PSS", saltLength: 32 }, pubKey,
  sig2, new TextEncoder().encode(ts + METHOD + withQuery));
check("query string is excluded from the pre-sign text", v2a && !v2b);

// 5. Ed25519 path (documented as supported) when the runtime offers it.
let edNote = "runtime does not expose Ed25519 in WebCrypto";
try {
  const ed = crypto.generateKeyPairSync("ed25519");
  const edPkcs8 = ed.privateKey.export({ type: "pkcs8", format: "pem" });
  const edSpki = ed.publicKey.export({ type: "spki", format: "pem" });
  const k = await subtle.importKey("pkcs8", der(edPkcs8), { name: "Ed25519" }, false, ["sign"]);
  const p = await subtle.importKey("spki", der(edSpki), { name: "Ed25519" }, false, ["verify"]);
  const s = await subtle.sign({ name: "Ed25519" }, k, msgFull);
  const ok = await subtle.verify({ name: "Ed25519" }, p, s, msgFull);
  check("Ed25519 sign/verify of the same pre-sign text works", ok);
  edNote = "Ed25519 available in this runtime";
} catch (e) { edNote = "Ed25519 unavailable: " + e.message; }

console.log("Kalshi request-signing rule self-test — " + new Date().toISOString());
console.log("runtime: node " + process.version + " (" + edNote + ")\n");
let fail = 0;
for (const r of results) { console.log((r.ok ? "PASS  " : "FAIL  ") + r.name + (r.detail ? "  " + r.detail : "")); if (!r.ok) fail++; }
console.log(`\n${results.length - fail}/${results.length} checks passed`);
process.exit(fail ? 1 : 0);
