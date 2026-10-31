import React from "react";

/**
 * Format inline styles: **bold**, *italic*, and `code`
 */
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

/**
 * Renders paragraph blocks supporting headers (#, ##, ###), bullet lists, and inline formatting
 */
export function renderFormattedContent(textBlock: string): React.ReactNode {
  if (!textBlock) return null;
  const lines = textBlock.split("\n");

  return (
    <div className="space-y-2.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-lg sm:text-xl font-black text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200 dark:border-slate-800 tracking-tight">
              {renderInlineFormatted(trimmed.slice(2))}
            </h2>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-base sm:text-lg font-bold text-slate-900 dark:text-white pt-2.5 pb-0.5 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block"></span>
              {renderInlineFormatted(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-300 pt-2 tracking-normal">
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

/**
 * Renders quiz question text with automatic support for:
 * 1. Markdown code blocks (```java ... ``` or ``` ... ```)
 * 2. Unquoted multi-line code (e.g. question prompt on line 1, and System.out... / Java code on subsequent lines)
 * 3. Inline formatting (**bold**, `inline code`)
 */
export function renderQuizQuestionContent(rawText: string): React.ReactNode {
  if (!rawText) return null;

  // Case 1: Contains explicit markdown code fence ```
  if (rawText.includes("```")) {
    const parts = rawText.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-3">
        {parts.map((part, idx) => {
          if (part.startsWith("```") && part.endsWith("```")) {
            const content = part.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "");
            return (
              <div key={idx} className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0F172A] shadow-md text-left font-mono">
                <div className="px-3.5 py-1.5 bg-[#1E293B]/80 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                    <span className="text-[11px] text-slate-400 font-semibold ml-1.5">Java Code</span>
                  </div>
                </div>
                <pre className="p-4 text-xs sm:text-sm text-indigo-300 font-mono overflow-x-auto whitespace-pre leading-relaxed m-0">
                  {content}
                </pre>
              </div>
            );
          }
          const trimmed = part.trim();
          if (!trimmed) return null;
          return (
            <div key={idx} className="leading-relaxed">
              {renderInlineFormatted(trimmed)}
            </div>
          );
        })}
      </div>
    );
  }

  // Case 2: Multi-line text where subsequent lines look like Java code
  const lines = rawText.split("\n");
  if (lines.length > 1) {
    const isCodeLine = (line: string) => {
      const t = line.trim();
      if (!t) return false;
      return (
        t.startsWith("System.out.") ||
        t.endsWith(";") ||
        t.endsWith("{") ||
        t.endsWith("}") ||
        t.startsWith("//") ||
        /^(public|private|protected|static|final|class|interface|void|int|double|float|boolean|char|String|Scanner|for|while|if|else|return|switch|case)\b/.test(t) ||
        line.startsWith("  ") ||
        line.startsWith("\t")
      );
    };

    let firstCodeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (isCodeLine(lines[i])) {
        firstCodeIdx = i;
        break;
      }
    }

    if (firstCodeIdx >= 0) {
      const textPart = lines.slice(0, firstCodeIdx).join("\n").trim();
      const codePart = lines.slice(firstCodeIdx).join("\n");

      return (
        <div className="space-y-3">
          {textPart && (
            <div className="leading-relaxed">
              {renderInlineFormatted(textPart)}
            </div>
          )}
          <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0F172A] shadow-md text-left font-mono">
            <div className="px-3.5 py-1.5 bg-[#1E293B]/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="text-[11px] text-slate-400 font-semibold ml-1.5">Java Code</span>
              </div>
            </div>
            <pre className="p-4 text-xs sm:text-sm text-indigo-300 font-mono overflow-x-auto whitespace-pre leading-relaxed m-0">
              {codePart}
            </pre>
          </div>
        </div>
      );
    }
  }

  // Case 3: Regular text
  return <div className="leading-relaxed whitespace-pre-wrap">{renderInlineFormatted(rawText)}</div>;
}