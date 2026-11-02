import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminCredential } from "./admin-access";

test("the requested authenticated email has dashboard access", () => {
  assert.equal(isAdminCredential("dwonluomovies@gmail.com"), true);
  assert.equal(isAdminCredential(" DWONLUOMOVIES@gmail.com "), true);
});

test("existing admin credentials retain dashboard access", () => {
  assert.equal(isAdminCredential("vjemmatruelightstudios@gmail.com"), true);
  assert.equal(isAdminCredential("p0760734679@vjemma.site"), true);
});

test("signed-out and unrelated credentials do not get dashboard access", () => {
  assert.equal(isAdminCredential(null), false);
  assert.equal(isAdminCredential(undefined), false);
  assert.equal(isAdminCredential(""), false);
  assert.equal(isAdminCredential("viewer@gmail.com"), false);
  assert.equal(isAdminCredential("dwonluomovies@gmail.com.attacker.example"), false);
});