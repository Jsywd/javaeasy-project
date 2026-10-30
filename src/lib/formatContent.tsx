import React from "react";

function renderInlineFormatted(text: string): React.ReactNode {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-extrabold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-800 dark:text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold border border-slate-300 dark:border-slate-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function renderFormattedContent(textBlock: string): React.ReactNode {
  if (!textBlock) return null;
  const lines = textBlock.split("\n");

  return (
    <div className="space-y-2.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={idx}
              className="text-lg sm:text-xl font-black text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200 dark:border-slate-800 tracking-tight"
            >
              {renderInlineFormatted(trimmed.slice(2))}
            </h2>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={idx}
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white pt-2.5 pb-0.5 tracking-tight flex items-center gap-2"
            >
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block"></span>
              {renderInlineFormatted(trimmed.slice(3))}
            </h3>
          );
        }

        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-300 pt-2 tracking-normal"
            >
              {renderInlineFormatted(trimmed.slice(4))}
            </h4>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></span>
              <span className="flex-1 leading-relaxed">{renderInlineFormatted(trimmed.slice(2))}</span>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        return (
          <p key={idx} className="leading-relaxed whitespace-pre-wrap">
            {renderInlineFormatted(line)}
          </p>
        );
      })}
    </div>
  );
}