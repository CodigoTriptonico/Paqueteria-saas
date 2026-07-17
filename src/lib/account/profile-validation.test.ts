import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avatarExtension,
  validateAvatarUpload,
  validateNewPassword,
  validateProfileName,
} from "@/lib/account/profile-validation";

describe("profile account validation", () => {
  it("requires a usable account name", () => {
    assert.equal(validateProfileName(" "), "Escribe tu nombre completo");
    assert.equal(validateProfileName("Pablo"), null);
    assert.match(validateProfileName("x".repeat(121)) || "", /120/);
  });

  it("requires the current password and a distinct confirmed replacement", () => {
    assert.equal(validateNewPassword("", "new-password", "new-password"), "Escribe tu contraseña actual");
    assert.match(validateNewPassword("old-password", "short", "short") || "", /al menos 8/);
    assert.match(validateNewPassword("same-password", "same-password", "same-password") || "", /distinta/);
    assert.match(validateNewPassword("old-password", "new-password", "other-password") || "", /no coincide/);
    assert.equal(validateNewPassword("old-password", "new-password", "new-password"), null);
  });

  it("only accepts a bounded image upload and derives a safe extension", () => {
    assert.match(validateAvatarUpload({ type: "image/gif", size: 100 } as File) || "", /JPG/);
    assert.match(validateAvatarUpload({ type: "image/jpeg", size: 4 * 1024 * 1024 + 1 } as File) || "", /4 MB/);
    assert.equal(validateAvatarUpload({ type: "image/webp", size: 100 } as File), null);
    assert.equal(avatarExtension("image/jpeg"), "jpg");
    assert.equal(avatarExtension("image/png"), "png");
    assert.equal(avatarExtension("image/webp"), "webp");
  });
});
