type Listener = () => void;

let notificationsPanelOpen = false;
const listeners = new Set<Listener>();

export function setOnboardingNotificationsPanelOpen(open: boolean) {
  if (notificationsPanelOpen === open) {
    return;
  }

  notificationsPanelOpen = open;
  listeners.forEach((listener) => listener());
}

export function isOnboardingNotificationsPanelOpen() {
  return notificationsPanelOpen;
}

export function subscribeOnboardingNotificationsPanelOpen(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
