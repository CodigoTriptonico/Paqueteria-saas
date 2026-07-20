export function shouldRegisterServiceWorker(input: {
  nodeEnv: string | undefined;
  protocol: string;
  hostname: string;
}) {
  if (input.nodeEnv !== "production") {
    return false;
  }

  return (
    input.protocol === "https:" ||
    input.hostname === "localhost" ||
    input.hostname === "127.0.0.1"
  );
}

export function shouldReloadAfterDevelopmentCleanup(input: {
  registrationCount: number;
  hasController: boolean;
}) {
  return input.registrationCount > 0 || input.hasController;
}
