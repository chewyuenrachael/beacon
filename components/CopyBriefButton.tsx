'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  markdown: string;
}

export default function CopyBriefButton({ markdown }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toSlackFormat(md: string): string {
    let slack = md;
    // Convert narrative theme slugs to readable labels
    const themeMap: [string, string][] = [
      ["safety-alignment", "Safety"],
      ["developer-experience", "Dev experience"],
      ["enterprise-adoption", "Enterprise"],
      ["competitive-positioning", "Competitive"],
      ["pricing-access", "Pricing"],
      ["open-source-ecosystem", "Ecosystem"],
      ["regulation-policy", "Regulation"],
    ];
    for (const [slug, label] of themeMap) {
      slack = slack.replaceAll(slug, label);
    }
    // Convert markdown links [text](url) to Slack format <url|text>
    slack = slack.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
    // Convert ## headers to *bold* (Slack bold)
    slack = slack.replace(/^## (.+)$/gm, '*$1*');
    slack = slack.replace(/^# (.+)$/gm, '*$1*');
    // Keep **bold** as *bold* for Slack
    slack = slack.replace(/\*\*(.+?)\*\*/g, '*$1*');
    return slack;
  }

  async function handleCopy(format: 'slack' | 'markdown') {
    const text = format === 'slack' ? toSlackFormat(markdown) : markdown;
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setOpen(false);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => handleCopy('slack')}
        className="px-3 py-1.5 text-sm border border-cream-200 rounded-l-md
                   hover:bg-cream-100 transition-colors"
      >
        {copied === 'slack' ? 'Copied!' : 'Copy for Slack'}
      </button>
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1.5 text-sm border border-l-0 border-cream-200
                   rounded-r-md hover:bg-cream-100 transition-colors"
      >
        &#9662;
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border
                        border-cream-200 rounded-md shadow-sm z-10 min-w-[160px]">
          <button
            onClick={() => handleCopy('slack')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-cream-100"
          >
            {copied === 'slack' ? 'Copied!' : 'Copy for Slack'}
          </button>
          <button
            onClick={() => handleCopy('markdown')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-cream-100"
          >
            {copied === 'markdown' ? 'Copied!' : 'Copy as Markdown'}
          </button>
        </div>
      )}
    </div>
  );
}
