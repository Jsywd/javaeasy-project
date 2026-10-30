import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  title?: string;
  output?: string; // 👈 เพิ่มรับ output
}

export default function SyntaxHighlighter({ code, language = "java", title, output }: SyntaxHighlighterProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const highlightCode = (rawCode: string, lang: string) => {
    if (!rawCode) return "";
    const cleanLang = (lang || "java").toLowerCase();
    const grammar = Prism.languages[cleanLang] || Prism.languages.java || Prism.languages.javascript;
    
    if (grammar) {
      try {
        return Prism.highlight(rawCode, grammar, cleanLang);
      } catch (err) {
        console.warn("Prism highlight error, fallback to clean escape:", err);
      }
    }

    return rawCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  return (
    <div id="code-block-container" className="my-6 overflow-hidden rounded-xl border border-slate-700/60 bg-[#1E293B] shadow-lg transition-all">
      {/* Header Bar */}
      <div id="code-block-header" className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-b border-slate-700/50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        <span className="font-mono flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          <span className="ml-1.5 capitalize text-slate-300 font-mono tracking-wider">{title || language} Code</span>
        </span>
        <button
          id="copy-code-btn"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-slate-800 border border-slate-700/60 hover:text-white text-slate-300 transition-all cursor-pointer font-sans text-[10px] font-bold"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold">คัดลอกแล้ว!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>คัดลอกโค้ด</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div id="code-block-body" className="p-4 overflow-x-auto text-xs md:text-xs font-mono leading-relaxed text-slate-300">
        <pre dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }} />
      </div>

      {/* 👇 เพิ่มกล่อง Output ด้านล่าง (จะแสดงเมื่อมีค่า output เท่านั้น) */}
      {output && output.trim() !== "" && (
        <div className="border-t border-slate-700/60 bg-[#090D16]">
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0F172A]/90 border-b border-slate-800 text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">
            <Terminal size={12} className="text-emerald-400" />
            <span>ผลลัพธ์การรัน (Output)</span>
          </div>
          <div className="p-4 text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}