"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type NotificationTone = "success" | "error" | "info";

type NotificationItem = {
  id: string;
  message: string;
  tone: NotificationTone;
};

type NotifyInput = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const NotificationContext = createContext<NotifyInput | null>(null);

const AUTO_DISMISS_MS = 4500;
const MAX_VISIBLE = 5;

const toneStyles: Record<
  NotificationTone,
  { box: string; icon: typeof CheckCircle2 }
> = {
  success: {
    box: "border-emerald-700/70 bg-[#142820] text-emerald-100",
    icon: CheckCircle2,
  },
  error: {
    box: "border-rose-700/70 bg-[#281418] text-rose-100",
    icon: XCircle,
  },
  info: {
    box: "border-sky-700/70 bg-[#142028] text-sky-100",
    icon: Info,
  },
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: NotificationTone) => {
      const trimmed = message.trim();

      if (!trimmed) {
        return;
      }

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setItems((current) => {
        const next = [...current, { id, message: trimmed, tone }];
        return next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next;
      });

      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const notify = useMemo<NotifyInput>(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push],
  );

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[500] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(100vw-2rem,22rem)]"
      >
        {items.map((item) => {
          const tone = toneStyles[item.tone];
          const Icon = tone.icon;

          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] ${tone.box}`}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-bold leading-snug">
                {item.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 rounded-md p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
                aria-label="Cerrar notificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const notify = useContext(NotificationContext);

  if (!notify) {
    throw new Error("useNotify must be used inside NotificationProvider");
  }

  return notify;
}
