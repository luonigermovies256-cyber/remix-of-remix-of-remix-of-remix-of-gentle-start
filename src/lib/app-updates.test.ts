import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_UPLOAD_API, resolveUploadBackend, resolveUploadToken } from "./upload-backend";
import { beginUpload, hasActiveUploads, isNewRelease } from "./app-update-policy";

describe("upload backend", () => {
  test("fixes the requested service token to * regardless of old settings or environment", () => {
    assert.equal(resolveUploadToken(DEFAULT_UPLOAD_API, "old-token", "old-env"), "*");
    assert.equal(resolveUploadToken(DEFAULT_UPLOAD_API + "/"), "*");
    assert.equal(resolveUploadToken("https://custom.example", "custom-token"), "custom-token");
  });
  test("uses the requested Workers service", () => {
    assert.equal(resolveUploadBackend(), "https://r2upload.nexusplatformafrica.workers.dev");
  });
  test("migrates previously saved upload services", () => {
    for (const id of ["e794", "9a7c"]) {
      assert.equal(resolveUploadBackend(`https://function-bun-production-${id}.up.railway.app/`), DEFAULT_UPLOAD_API);
    }
  });
  test("preserves intentional disabled and custom settings", () => {
    assert.equal(resolveUploadBackend(""), "");
    assert.equal(resolveUploadBackend("https://custom.example/"), "https://custom.example");
  });
});

describe("automatic updates", () => {
  test("refreshes only for a different valid release", () => {
    assert.equal(isNewRelease("release-1", "release-2"), true);
    assert.equal(isNewRelease("release-1", "release-1"), false);
    assert.equal(isNewRelease("release-1", undefined), false);
    assert.equal(isNewRelease("release-1", ""), false);
  });
  test("protects all concurrent uploads until each completes", () => {
    const first = beginUpload();
    const second = beginUpload();
    assert.equal(hasActiveUploads(), true);
    first();
    first();
    assert.equal(hasActiveUploads(), true);
    second();
    assert.equal(hasActiveUploads(), false);
  });
});