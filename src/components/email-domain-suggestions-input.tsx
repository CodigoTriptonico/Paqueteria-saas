"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  appendAtToEmailLocalPart,
  emailDomainSuggestionsShouldOpen,
  getEmailDomainSuggestions,
  normalizeEmailInputValue,
  shouldShowEmailAtSuggestion,
} from "@/lib/email/domains";

type EmailDomainSuggestionsInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  icon?: ReactNode;
  listboxId?: string;
};

const listboxClass =
  "absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-black bg-[#101820] shadow-2xl";

function renderSuggestionLabel(currentValue: string, suggestion: string, highlighted: boolean) {
  const prefix =
    suggestion.toLowerCase().startsWith(currentValue.toLowerCase()) ? currentValue : "";
  const typed = suggestion.slice(0, prefix.length);
  const completion = suggestion.slice(prefix.length);

  return (
    <span className="truncate text-sm">
      <span
        className={`font-bold ${highlighted ? "text-slate-300" : "text-slate-500"}`}
      >
        {typed}
      </span>
      {completion ? (
        <span
          className={`font-black ${highlighted ? "text-[#34D399]" : "text-emerald-400/90"}`}
        >
          {completion}
        </span>
      ) : null}
    </span>
  );
}

export function EmailDomainSuggestionsInput({
  value,
  onChange,
  className,
  inputClassName,
  name,
  placeholder,
  disabled = false,
  autoComplete = "off",
  icon,
  listboxId: listboxIdProp,
}: EmailDomainSuggestionsInputProps) {
  const generatedListboxId = useId();
  const listboxId = listboxIdProp ?? `email-domains-${generatedListboxId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const cleanValue = value.trim();
  const showAtSuggestion = shouldShowEmailAtSuggestion(value);
  const suggestions = useMemo(() => getEmailDomainSuggestions(value), [value]);
  const showList = open && suggestions.length > 0;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setHighlightIndex(-1);
    });
    return () => {
      active = false;
    };
  }, [value, suggestions.length]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function applySuggestion(next: string) {
    onChange(next);
    setOpen(emailDomainSuggestionsShouldOpen(next));
    setHighlightIndex(-1);
  }

  function handleChange(next: string) {
    const normalized = normalizeEmailInputValue(next);
    onChange(normalized);
    setOpen(emailDomainSuggestionsShouldOpen(normalized));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (showAtSuggestion && event.key === " ") {
      event.preventDefault();
      applySuggestion(appendAtToEmailLocalPart(value));
      return;
    }

    if (!showList) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setHighlightIndex(0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && highlightIndex >= 0) {
      event.preventDefault();
      applySuggestion(suggestions[highlightIndex]!);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className={`${className ?? ""} relative ${showList ? "z-[999]" : ""}`}>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {icon}
          </span>
        ) : null}
        <input
          className={inputClassName}
          type="email"
          name={name}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode="email"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showList}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {showAtSuggestion ? (
          <div
            aria-hidden
            className={`${inputClassName} pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre border-transparent bg-transparent text-transparent shadow-none`}
          >
            <span>{cleanValue}</span>
            <button
              type="button"
              tabIndex={-1}
              className="pointer-events-auto text-slate-400/70 hover:text-emerald-300"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applySuggestion(appendAtToEmailLocalPart(value))}
            >
              @
            </button>
          </div>
        ) : null}
        {showList ? (
          <div id={listboxId} role="listbox" className={listboxClass}>
            {suggestions.map((suggestion, index) => {
              const highlighted = index === highlightIndex;
              return (
                <button
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                  className={`w-full border-b border-black px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-card-header ${
                    highlighted ? "bg-surface-card-header" : ""
                  }`}
                >
                  {renderSuggestionLabel(value, suggestion, highlighted)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
