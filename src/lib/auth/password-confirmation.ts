export function passwordConfirmationMessage(password: string, confirmation: string): string | null {
  if (!confirmation.trim()) {
    return "Confirma la contrase\u00f1a.";
  }

  if (password.trim() !== confirmation.trim()) {
    return "Las contrase\u00f1as no coinciden.";
  }

  return null;
}
