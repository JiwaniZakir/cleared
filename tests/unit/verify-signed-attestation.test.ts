import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "crypto";
import { prepareSignedAttestationTool } from "@/lib/tools/prepare-signed-attestation";
import { verifySignedAttestationTool } from "@/lib/tools/verify-signed-attestation";

function makeKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, public_key_base64: publicKey.export({ type: "spki", format: "der" }).toString("base64") };
}

function signWith(privateKey: ReturnType<typeof makeKeypair>["privateKey"], payload: string) {
  return sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64");
}

describe("verify_signed_attestation", () => {
  // The two-party flow was once only half-built: sign with
  // prepare_signed_attestation, share exactly what it outputs, and verify THAT
  // as a recipient would — no hand-reconstruction.
  it("round trip: a credential produced by prepare_signed_attestation verifies from its own shared fields", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const claims = { clearance_level: "secret", citizenship_status: "us_citizen" };
    const signed_payload = JSON.stringify({ claims, issued_at: "2026-11-12T16:00:00Z" });
    const prepared = await prepareSignedAttestationTool.handler({
      claims: claims as never,
      issued_at: "2026-11-12T16:00:00Z",
      signed_payload,
      signature_base64: signWith(privateKey, signed_payload),
      public_key_base64,
    });

    // Recover the shared JSON block from the markdown exactly as a recipient would receive it.
    const json = JSON.parse(prepared.shareableMarkdown.split("```json\n")[1].split("\n```")[0]);
    const result = await verifySignedAttestationTool.handler({
      signed_payload: json.signed_payload,
      signature_base64: json.signature_base64,
      public_key_base64: json.public_key_base64,
    });
    expect(result.signatureValid).toBe(true);
    expect(result.claims).toEqual(claims);
    expect(result.issuedAt).toBe("2026-11-12T16:00:00Z");
    expect(result.keyFingerprint).toBe(prepared.credential.proof.keyFingerprint);
  });

  it("the signer's serialization doesn't matter — whitespace/key order in signed_payload still verifies byte-for-byte", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const signed_payload = '{ "issued_at": "2026-11-12T16:00:00Z", "claims": { "clearance_level": "ts" } }';
    const result = await verifySignedAttestationTool.handler({
      signed_payload,
      signature_base64: signWith(privateKey, signed_payload),
      public_key_base64,
    });
    expect(result.signatureValid).toBe(true);
    expect(result.claims).toEqual({ clearance_level: "ts" });
  });

  it("reports a tampered payload as invalid — as a normal answer, not an error — and surfaces no claims from it", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const original = JSON.stringify({ claims: { clearance_level: "secret" }, issued_at: "2026-11-12T16:00:00Z" });
    const tampered = JSON.stringify({ claims: { clearance_level: "ts_sci" }, issued_at: "2026-11-12T16:00:00Z" });
    const result = await verifySignedAttestationTool.handler({
      signed_payload: tampered,
      signature_base64: signWith(privateKey, original),
      public_key_base64,
    });
    expect(result.signatureValid).toBe(false);
    expect(result.claims).toBeNull(); // never hand a reader the forged content
    expect(result.whatThisProves).toMatch(/^Nothing/);
  });

  it("reports a signature from a different keypair as invalid", async () => {
    const signer = makeKeypair();
    const impostor = makeKeypair();
    const payload = JSON.stringify({ claims: { clearance_level: "secret" }, issued_at: "2026-11-12T16:00:00Z" });
    const result = await verifySignedAttestationTool.handler({
      signed_payload: payload,
      signature_base64: signWith(signer.privateKey, payload),
      public_key_base64: impostor.public_key_base64,
    });
    expect(result.signatureValid).toBe(false);
  });

  it("gives the same fingerprint for the same key across separate credentials, and different ones for different keys", async () => {
    const a = makeKeypair();
    const b = makeKeypair();
    const p1 = JSON.stringify({ claims: { clearance_level: "secret" }, issued_at: "2026-11-01T00:00:00Z" });
    const p2 = JSON.stringify({ claims: { available_from: "2026-12-01" }, issued_at: "2026-11-12T00:00:00Z" });
    const r1 = await verifySignedAttestationTool.handler({ signed_payload: p1, signature_base64: signWith(a.privateKey, p1), public_key_base64: a.public_key_base64 });
    const r2 = await verifySignedAttestationTool.handler({ signed_payload: p2, signature_base64: signWith(a.privateKey, p2), public_key_base64: a.public_key_base64 });
    const r3 = await verifySignedAttestationTool.handler({ signed_payload: p1, signature_base64: signWith(b.privateKey, p1), public_key_base64: b.public_key_base64 });
    expect(r1.keyFingerprint).toBe(r2.keyFingerprint);
    expect(r1.keyFingerprint).not.toBe(r3.keyFingerprint);
  });

  it("garbage key/signature input returns invalid rather than throwing", async () => {
    const result = await verifySignedAttestationTool.handler({
      signed_payload: '{"claims":{},"issued_at":"x"}',
      signature_base64: "not-a-signature",
      public_key_base64: "not-a-key",
    });
    expect(result.signatureValid).toBe(false);
  });

  it("always states what a valid signature does NOT prove — truth of the claim, or real-world identity", async () => {
    const result = await verifySignedAttestationTool.handler({ signed_payload: "x", signature_base64: "x", public_key_base64: "x" });
    expect(result.whatThisDoesNotProve).toMatch(/whether any claim is true/i);
    expect(result.whatThisDoesNotProve).toMatch(/Facility Security Officer/);
  });
});

// Both tools once said the signature proves WHEN a claim was signed. issued_at
// is the signer's own statement — live, a statement dated 2019-01-01 was
// accepted and shown as "Signed 2019-01-01".
describe("the signing time is the signer's stated time, and an old one is flagged", () => {
  it("neither tool's description or output claims the signature proves when", async () => {
    for (const text of [prepareSignedAttestationTool.description, verifySignedAttestationTool.description]) {
      expect(text).not.toMatch(/WHO signed the claim and WHEN|who signed and when|proves who signed/i);
      expect(text).toMatch(/stated time|own statement/i);
    }
    const { privateKey, public_key_base64 } = makeKeypair();
    const issued_at = new Date().toISOString();
    const signed_payload = JSON.stringify({ claims: { clearance_level: "secret" }, issued_at });
    const signature_base64 = signWith(privateKey, signed_payload);
    const prepared = await prepareSignedAttestationTool.handler({
      claims: { clearance_level: "secret" },
      issued_at,
      signed_payload,
      signature_base64,
      public_key_base64,
    });
    expect(prepared.whatThisProves).not.toMatch(/at the stated time,/);
    expect(prepared.whatThisProves).toMatch(/signer's stated time/);
    expect(prepared.shareableMarkdown).toContain(`Signer's stated time: ${issued_at}`);
    expect(prepared.shareableMarkdown).not.toMatch(/proves who signed this and when/);
    const verified = await verifySignedAttestationTool.handler({ signed_payload, signature_base64, public_key_base64 });
    expect(verified.whatThisProves).toMatch(/signer's stated time/);
    expect(verified.statedTimeCheck).toMatchObject({ ageDays: 0, isOld: false, isInFuture: false, thresholdDays: 30 });
  });

  it("a validly signed statement dated 2019 verifies, but is flagged as old with the threshold stated", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const signed_payload = JSON.stringify({ claims: { clearance_level: "ts" }, issued_at: "2019-01-01T00:00:00Z" });
    const result = await verifySignedAttestationTool.handler({
      signed_payload,
      signature_base64: signWith(privateKey, signed_payload),
      public_key_base64,
    });
    expect(result.signatureValid).toBe(true);
    expect(result.issuedAt).toBe("2019-01-01T00:00:00Z");
    expect(result.statedTimeCheck?.isOld).toBe(true);
    expect(result.statedTimeCheck?.ageDays).toBeGreaterThan(2000);
    expect(result.statedTimeCheck?.note).toMatch(/30-day threshold/);
    expect(result.statedTimeCheck?.note).toMatch(/ask for a freshly signed statement/);
  });

  it("the threshold is exclusive at 30 days, and a future stated time is flagged too", async () => {
    const { checkStatedTime } = await import("@/lib/attestation/stated-time");
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(checkStatedTime("2026-10-14T12:00:00Z", now)).toMatchObject({ ageDays: 30, isOld: false });
    expect(checkStatedTime("2026-10-13T11:00:00Z", now)).toMatchObject({ ageDays: 31, isOld: true });
    expect(checkStatedTime("2026-11-14T12:00:00Z", now)).toMatchObject({ isInFuture: true, isOld: false });
    expect(checkStatedTime("not a time", now)).toMatchObject({ ageDays: null, isOld: false });
  });

  it("no stated-time verdict is given for a payload whose signature fails", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const signed_payload = JSON.stringify({ claims: { clearance_level: "ts" }, issued_at: "2019-01-01T00:00:00Z" });
    const result = await verifySignedAttestationTool.handler({
      signed_payload: signed_payload.replace("ts", "secret"),
      signature_base64: signWith(privateKey, signed_payload),
      public_key_base64,
    });
    expect(result.signatureValid).toBe(false);
    expect(result.statedTimeCheck).toBeNull();
  });

  it("the signer is told before sharing when issued_at is already past the threshold", async () => {
    const { privateKey, public_key_base64 } = makeKeypair();
    const issued_at = "2025-01-01T00:00:00Z";
    const signed_payload = JSON.stringify({ claims: { available_from: "2027-01-01" }, issued_at });
    const prepared = await prepareSignedAttestationTool.handler({
      claims: { available_from: "2027-01-01" },
      issued_at,
      signed_payload,
      signature_base64: signWith(privateKey, signed_payload),
      public_key_base64,
    });
    expect(prepared.claimNotes.some((n) => /flags a stated time older than 30 days/.test(n))).toBe(true);
  });
});
