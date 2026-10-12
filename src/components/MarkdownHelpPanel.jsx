import React, { useState } from "react";
import { Check, Copy, HelpCircle, X } from "lucide-react";

const GUIDE_SECTIONS = [
  {
    title: "Headers & Text Style",
    items: [
      { label: "Heading 1", syntax: "# Title", example: "# Document Title" },
      { label: "Heading 2", syntax: "## Subtitle", example: "## Section Subtitle" },
      { label: "Bold", syntax: "**Text**", example: "**Strong text**" },
      { label: "Italic", syntax: "*Text*", example: "*Emphasized text*" },
      { label: "Strikethrough", syntax: "~~Text~~", example: "~~Strikethrough text~~" }
    ]
  },
  {
    title: "Lists & Checkboxes",
    items: [
      { label: "Unordered List", syntax: "- Item", example: "- Apple\n- Orange" },
      { label: "Ordered List", syntax: "1. Item", example: "1. Create file\n2. Real-time sync" },
      { label: "Task Checklist", syntax: "- [ ] Task", example: "- [x] Finish task\n- [ ] Pending task" }
    ]
  },
  {
    title: "Blocks & Codes",
    items: [
      { label: "Blockquote", syntax: "> Quote", example: "> Better a diamond with a flaw than a pebble without." },
      { label: "Inline Code", syntax: "`code`", example: "Run `npm run dev` in your shell" },
      { label: "Code Block", syntax: "```js\\n...\\n```", example: "```ts\nconst name = 'Yjs';\n```" }
    ]
  },
  {
    title: "Links, Images & Rows",
    items: [
      { label: "Hyperlink", syntax: "[Title](URL)", example: "[Google](https://google.com)" },
      { label: "Image Embed", syntax: "![Alt](ImgURL)", example: "![Avatar](https://example.com/logo.png)" },
      { label: "Horizontal Rule", syntax: "---", example: "---" }
    ]
  }
];

export default function MarkdownHelpPanel({ onClose }) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (syntax, itemId) => {
    navigator.clipboard.writeText(syntax);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="w-80 h-full border-l border-zinc-200 bg-zinc-50 flex flex-col shadow-inner select-none shrink-0" id="markdown-help-panel">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-zinc-950 font-sans tracking-tight">Markdown Syntax Guide</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Close help"
          id="close-help-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Guide Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {GUIDE_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
              {section.title}
            </h4>
            <div className="space-y-2">
              {section.items.map((item, iIdx) => {
                const itemId = `${sIdx}-${iIdx}`;
                const isCopied = copiedId === itemId;
                return (
                  <div key={iIdx} className="bg-white p-3 rounded-lg border border-zinc-100 shadow-xs flex flex-col gap-1.5 hover:border-zinc-200 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-600 font-sans">{item.label}</span>
                      <button
                        onClick={() => handleCopy(item.syntax, itemId)}
                        className="p-1 rounded text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Copy syntax"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 animate-scale" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <code className="text-[11px] font-mono p-1 px-1.5 bg-zinc-100 rounded text-indigo-600 block leading-normal break-all">
                      {item.syntax}
                    </code>
                    <div className="text-[10px] text-zinc-400 font-sans">
                      Example:
                      <pre className="mt-1 font-mono text-[10px] bg-zinc-50 p-1 px-1.5 rounded text-zinc-500 whitespace-pre-wrap truncate leading-tight">
                        {item.example}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
