const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

const AVATAR_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const PROFILE_AVATAR_BUCKET = "profile-avatars";

export function validateProfileName(value: string): string | null {
  const name = value.trim();

  if (name.length < 2) {
    return "Escribe tu nombre completo";
  }

  if (name.length > 120) {
    return "El nombre no puede superar 120 caracteres";
  }

  return null;
}

export function validateNewPassword(
  currentPassword: string,
  nextPassword: string,
  confirmation: string,
): string | null {
  if (!currentPassword) {
    return "Escribe tu contraseña actual";
  }

  if (nextPassword.length < 8) {
    return "La nueva contraseña debe tener al menos 8 caracteres";
  }

  if (nextPassword === currentPassword) {
    return "La nueva contraseña debe ser distinta a la actual";
  }

  if (nextPassword !== confirmation) {
    return "La confirmación no coincide con la nueva contraseña";
  }

  return null;
}

export function validateAvatarUpload(file: Pick<File, "size" | "type">): string | null {
  if (!AVATAR_CONTENT_TYPES.has(file.type)) {
    return "La foto debe ser JPG, PNG o WebP";
  }

  if (file.size <= 0) {
    return "La foto está vacía";
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return "La foto no puede pesar más de 4 MB";
  }

  return null;
}

export function avatarExtension(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "jpg";
}
