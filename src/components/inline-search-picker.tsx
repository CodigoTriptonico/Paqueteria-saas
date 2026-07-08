"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

export type InlineSearchPickerOption = {
  value: string;
  label: string;
  searchText?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** No cambia el valor; solo dispara onSelectOption (p. ej. ir a crear país). */
  action?: boolean;
  /** Visible pero no seleccionable (p. ej. ya agregado al país). */
  disabled?: boolean;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

const PANEL_MIN_WIDTH = 200;
const PANEL_CHAR_WIDTH = 7.2;
const PANEL_HORIZONTAL_PADDING = 48;

export function resolveInlineSearchPanelWidth(
  triggerWidth: number,
  labels: readonly string[],
  viewportWidth = 1280,
) {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  const estimated = Math.ceil(longest * PANEL_CHAR_WIDTH + PANEL_HORIZONTAL_PADDING);
  const viewportMax = Math.max(PANEL_MIN_WIDTH, viewportWidth - 16);

  return Math.min(Math.max(PANEL_MIN_WIDTH, triggerWidth, estimated), viewportMax);
}

const shellBaseClass =
  "box-border inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-solid px-2.5 bg-surface-inset";

function shellStateClass(active: boolean, disabled: boolean) {
  if (disabled) {
    return "cursor-not-allowed border-black opacity-60";
  }

  return active ? "border-emerald-500/60" : "border-black";
}

const fieldClass =
  "min-w-0 flex-1 h-full border-0 bg-transparent p-0 text-sm font-black leading-5 outline-none";

const trailingSlotClass =
  "inline-flex h-4 w-4 shrink-0 items-center justify-center";

function subscribeToDomReady() {
  return () => {};
}

function getDomReadySnapshot() {
  return typeof document !== "undefined";
}

function getServerDomReadySnapshot() {
  return false;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export type InlineSearchPickerProps = {
  options: InlineSearchPickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  compact?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  ariaLabel?: string;
  minWidthClass?: string;
  disabled?: boolean;
  shellClassName?: string;
  onSelectOption?: (option: InlineSearchPickerOption) => void;
  formatSelectedLabel?: (
    option: InlineSearchPickerOption | undefined,
    placeholder: string,
  ) => string;
  /** Abre el panel al montar (p. ej. dentro de un popover recién abierto). */
  openOnMount?: boolean;
};

export function InlineSearchPicker({
  options,
  value,
  onChange,
  placeholder = "Elegir…",
  searchPlaceholder = "Buscar…",
  emptyLabel = "Sin coincidencias",
  compact = true,
  leadingIcon,
  className = "",
  ariaLabel,
  minWidthClass = "min-w-[11rem] sm:min-w-[14rem]",
  disabled = false,
  shellClassName,
  onSelectOption,
  formatSelectedLabel,
  openOnMount = false,
}: InlineSearchPickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lockedWidth, setLockedWidth] = useState<number | undefined>();
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToDomReady,
    getDomReadySnapshot,
    getServerDomReadySnapshot,
  );

  const activeOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearch(query);

    if (!normalized) {
      return options;
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.searchText ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setPanelPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(PANEL_MIN_WIDTH, rect.width),
    });
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) {
      return;
    }

    if (rootRef.current) {
      setLockedWidth(rootRef.current.getBoundingClientRect().width);
    }

    setOpen(true);
  }, [disabled]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setLockedWidth(undefined);
  }, []);

  const selectOption = useCallback(
    (option: InlineSearchPickerOption) => {
      if (option.disabled) {
        return;
      }

      if (option.action) {
        onSelectOption?.(option);
        close();
        return;
      }

      onChange(option.value);
      onSelectOption?.(option);
      close();
    },
    [close, onChange, onSelectOption],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePanelPosition();
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!openOnMount || disabled) {
      return;
    }

    openPicker();
  }, [disabled, openOnMount, openPicker]);

  const shellClass = shellClassName
    ? shellClassName
    : compact
      ? `${shellBaseClass} ${minWidthClass}`
      : `${shellBaseClass} h-11 w-full min-w-[12rem] max-w-xs px-3`;

  const panelWidth = useMemo(() => {
    if (!panelPosition) {
      return PANEL_MIN_WIDTH;
    }

    return resolveInlineSearchPanelWidth(
      panelPosition.width,
      filteredOptions.map((option) => option.label),
    );
  }, [filteredOptions, panelPosition]);

  const panel =
    open && panelPosition && mounted ? (
      <div
        ref={panelRef}
        id={listboxId}
        role="listbox"
        data-inline-search-picker-panel
        className="fixed z-[120] overflow-hidden rounded-lg border border-black bg-[#101820] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelWidth,
        }}
      >
        <ul className="max-h-52 overflow-y-auto py-1">
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const selected = option.value === value;
              const isDisabled = Boolean(option.disabled);

              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                      isDisabled
                        ? "cursor-not-allowed text-slate-600"
                        : option.action
                          ? "text-emerald-300 hover:bg-emerald-400/10"
                          : selected
                            ? "bg-emerald-400/15 text-emerald-100"
                            : "text-slate-200 hover:bg-surface-card-header/80"
                    }`}
                  >
                    {option.icon ? (
                      <span className="shrink-0">{option.icon}</span>
                    ) : null}
                    <span className="min-w-0 flex-1 whitespace-normal break-words capitalize">
                      {option.label}
                    </span>
                    {option.trailing ? (
                      <span className="shrink-0">{option.trailing}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-4 text-center text-sm font-bold text-slate-500">
              {emptyLabel}
            </li>
          )}
        </ul>
      </div>
    ) : null;

  const triggerLabel = formatSelectedLabel
    ? formatSelectedLabel(activeOption, placeholder)
    : activeOption?.label || placeholder;

  const triggerIcon = leadingIcon ?? activeOption?.icon;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        ref={rootRef}
        className={`${shellClass} ${shellStateClass(open, disabled)}`}
        style={lockedWidth ? { width: lockedWidth } : undefined}
      >
        {triggerIcon ? (
          <span className="shrink-0 text-emerald-400/80">{triggerIcon}</span>
        ) : null}
        {open ? (
          <input
            ref={searchRef}
            type="text"
            className={`${fieldClass} text-[#f8fafc] placeholder:font-bold placeholder:text-slate-500`}
            placeholder={searchPlaceholder}
            value={query}
            aria-label={ariaLabel}
            disabled={disabled}
            aria-controls={listboxId}
            aria-expanded
            aria-autocomplete="list"
            role="combobox"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const nextOption = filteredOptions.find((option) => !option.disabled);

                if (nextOption) {
                  event.preventDefault();
                  selectOption(nextOption);
                }
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={`${fieldClass} min-w-0 truncate text-left capitalize text-[#f8fafc] disabled:cursor-not-allowed`}
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-label={ariaLabel}
            onClick={openPicker}
          >
            {triggerLabel}
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          className={`${trailingSlotClass} text-slate-400 disabled:cursor-not-allowed`}
          aria-label={open ? "Cerrar" : "Abrir"}
          onClick={() => (open ? close() : openPicker())}
        >
          <ChevronDown
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

export type InlineSearchComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: InlineSearchPickerOption[];
  placeholder?: string;
  emptyLabel?: string;
  compact?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  ariaLabel?: string;
  minWidthClass?: string;
  disabled?: boolean;
  /** Mantiene el input visible al perder foco (filtros en toolbar). */
  persistent?: boolean;
  shellClassName?: string;
  onSelectOption?: (option: InlineSearchPickerOption) => void;
};

export function InlineSearchCombobox({
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  emptyLabel = "Sin coincidencias",
  compact = true,
  leadingIcon,
  className = "",
  ariaLabel,
  minWidthClass = "min-w-[11rem] sm:min-w-[14rem]",
  disabled = false,
  persistent = false,
  shellClassName,
  onSelectOption,
}: InlineSearchComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [lockedWidth, setLockedWidth] = useState<number | undefined>();
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToDomReady,
    getDomReadySnapshot,
    getServerDomReadySnapshot,
  );

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearch(value);

    if (!normalized) {
      return options;
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.searchText ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, value]);

  const activeOption = useMemo(() => {
    const normalized = normalizeSearch(value);

    if (!normalized) {
      return undefined;
    }

    return options.find((option) => normalizeSearch(option.label) === normalized);
  }, [options, value]);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setPanelPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(PANEL_MIN_WIDTH, rect.width),
    });
  }, []);

  const openCombobox = useCallback(() => {
    if (disabled) {
      return;
    }

    if (rootRef.current) {
      setLockedWidth(rootRef.current.getBoundingClientRect().width);
    }

    setOpen(true);
  }, [disabled]);

  const close = useCallback(() => {
    setOpen(false);
    setLockedWidth(undefined);
  }, []);

  const selectOption = useCallback(
    (option: InlineSearchPickerOption) => {
      onChange(option.label);
      onSelectOption?.(option);
      close();
    },
    [close, onChange, onSelectOption],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePanelPosition();
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  const shellClass = shellClassName
    ? shellClassName
    : compact
      ? `${shellBaseClass} ${minWidthClass}`
      : `${shellBaseClass} h-11 w-full min-w-[12rem] max-w-xs px-3`;

  const isActive = persistent || open || value.trim().length > 0;
  const showInput = persistent || open || value.trim().length > 0;

  const panelWidth = useMemo(() => {
    if (!panelPosition) {
      return PANEL_MIN_WIDTH;
    }

    return resolveInlineSearchPanelWidth(
      panelPosition.width,
      filteredOptions.map((option) => option.label),
    );
  }, [filteredOptions, panelPosition]);

  const panel =
    open && panelPosition && mounted ? (
      <div
        ref={panelRef}
        id={listboxId}
        role="listbox"
        data-inline-search-picker-panel
        className="fixed z-[120] overflow-hidden rounded-lg border border-black bg-[#101820] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelWidth,
        }}
      >
        <ul className="max-h-52 overflow-y-auto py-1">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={normalizeSearch(value) === normalizeSearch(option.label)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-slate-200 transition hover:bg-surface-card-header/80"
                >
                  {option.icon ? (
                    <span className="shrink-0">{option.icon}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 whitespace-normal break-words capitalize">
                    {option.label}
                  </span>
                  {option.trailing ? (
                    <span className="shrink-0">{option.trailing}</span>
                  ) : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-sm font-bold text-slate-500">
              {emptyLabel}
            </li>
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={rootRef}
        className={`${shellClass} ${
          shellClassName
            ? isActive && !disabled
              ? "ring-1 ring-inset ring-emerald-500/25"
              : ""
            : shellStateClass(isActive, disabled)
        }`}
        style={lockedWidth ? { width: lockedWidth } : undefined}
      >
        {activeOption?.icon ? (
          <span className="shrink-0">{activeOption.icon}</span>
        ) : leadingIcon ? (
          <span className="shrink-0 text-slate-500">{leadingIcon}</span>
        ) : null}
        {showInput ? (
          <input
            ref={searchRef}
            type="text"
            className={`${fieldClass} text-[#f8fafc] placeholder:font-bold placeholder:text-slate-500`}
            placeholder={placeholder}
            value={value}
            aria-label={ariaLabel}
            disabled={disabled}
            aria-controls={listboxId}
            aria-expanded={open}
            aria-autocomplete="list"
            role="combobox"
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => {
              if (!disabled) {
                openCombobox();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredOptions[0]) {
                event.preventDefault();
                selectOption(filteredOptions[0]);
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={`${fieldClass} truncate text-left capitalize disabled:cursor-not-allowed ${
              value.trim() ? "text-[#f8fafc]" : "text-slate-500"
            }`}
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-label={ariaLabel}
            onClick={openCombobox}
          >
            {value.trim() ? value : placeholder}
          </button>
        )}
        {value.trim() && !open ? (
          <button
            type="button"
            disabled={disabled}
            className={`${trailingSlotClass} text-slate-500 hover:text-slate-300 disabled:cursor-not-allowed`}
            aria-label="Limpiar búsqueda"
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={`${trailingSlotClass} text-slate-400 disabled:cursor-not-allowed`}
            aria-label={open ? "Cerrar" : "Abrir"}
            onClick={() => (open ? close() : openCombobox())}
          >
            <ChevronDown
              className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}
      </div>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

export type InlineSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  ariaLabel?: string;
  minWidthClass?: string;
};

export function InlineSearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  compact = true,
  leadingIcon,
  className = "",
  ariaLabel,
  minWidthClass = "min-w-[11rem] sm:min-w-[14rem]",
}: InlineSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const openInput = useCallback(() => {
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (!value.trim()) {
      onChange("");
    }
  }, [onChange, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const root = inputRef.current?.closest("[data-inline-search-input]");

      if (root?.contains(target)) {
        return;
      }

      close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  const shellClass = compact
    ? `${shellBaseClass} ${minWidthClass}`
    : `${shellBaseClass} h-11 w-full min-w-[12rem] max-w-xs px-3`;

  const isActive = open || value.trim().length > 0;

  return (
    <div className={`relative shrink-0 ${className}`} data-inline-search-input>
      <div className={`${shellClass} ${shellStateClass(isActive, false)}`}>
        {leadingIcon ? (
          <span className="shrink-0 text-slate-500">{leadingIcon}</span>
        ) : null}
        {open || value.trim() ? (
          <input
            ref={inputRef}
            type="text"
            className={`${fieldClass} text-[#f8fafc] placeholder:font-bold placeholder:text-slate-500`}
            placeholder={placeholder}
            value={value}
            aria-label={ariaLabel}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`${fieldClass} truncate text-left font-bold text-slate-500`}
            aria-label={ariaLabel}
            onClick={openInput}
          >
            {placeholder}
          </button>
        )}
        {value.trim() ? (
          <button
            type="button"
            className={`${trailingSlotClass} text-slate-500 hover:text-slate-300`}
            aria-label="Limpiar búsqueda"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className={`${trailingSlotClass} text-slate-400`}
            aria-label="Buscar"
            onClick={() => (open ? close() : openInput())}
          >
            <ChevronDown
              className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}
      </div>
    </div>
  );
}
