const TEMPORARY_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(random = Math.random) {
  let password = "";

  for (let index = 0; index < 10; index += 1) {
    password += TEMPORARY_PASSWORD_ALPHABET[
      Math.floor(random() * TEMPORARY_PASSWORD_ALPHABET.length)
    ];
  }

  return password;
}
