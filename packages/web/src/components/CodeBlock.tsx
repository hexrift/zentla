import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { clsx } from 'clsx';

interface CodeBlockProps {
  children: string;
  title?: string;
  language?: string;
}

// Map common language aliases
const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  text: 'text',
  txt: 'text',
  http: 'http',
};

export function CodeBlock({ children, title, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Normalize language
  const normalizedLang = languageMap[language.toLowerCase()] || language.toLowerCase();

  return (
    <div className="not-prose my-4 rounded-lg overflow-hidden bg-[#1e1e2e] border border-gray-800 shadow-lg">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-gray-800">
        <div className="flex items-center gap-2">
          {/* Window buttons */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#f38ba8]" />
            <div className="w-3 h-3 rounded-full bg-[#f9e2af]" />
            <div className="w-3 h-3 rounded-full bg-[#a6e3a1]" />
          </div>
          {/* Title */}
          {title && (
            <span className="ml-3 text-xs text-gray-500 font-mono">{title}</span>
          )}
          {language && !title && (
            <span className="ml-3 text-xs text-gray-500 font-mono">{language}</span>
          )}
        </div>
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-all',
            copied
              ? 'text-green-400 bg-green-400/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          )}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code content with syntax highlighting */}
      <div className="overflow-x-auto">
        <Highlight theme={themes.nightOwl} code={children.trim()} language={normalizedLang as any}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={clsx(className, 'p-4 text-sm leading-relaxed')}
              style={{ ...style, backgroundColor: 'transparent', margin: 0 }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell pr-4 text-gray-600 select-none text-right text-xs w-8">
                    {i + 1}
                  </span>
                  <span className="table-cell">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
