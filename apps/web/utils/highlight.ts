import { createElement, type ReactNode } from "react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(text: string, keyword: string): ReactNode {
  const terms = Array.from(
    new Set(
      keyword
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => term.toLowerCase()),
    ),
  );

  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isMatch = terms.includes(part.toLowerCase());

    if (!isMatch) {
      return part;
    }

    return createElement(
      "mark",
      {
        key: `${part}-${index}`,
        className: "rounded bg-yellow-200 px-0.5 text-slate-950",
      },
      part,
    );
  });
}
