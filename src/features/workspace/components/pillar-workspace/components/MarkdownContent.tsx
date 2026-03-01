import React from 'react';
import ReactMarkdown from 'react-markdown';
import { safeRender, cleanMarkdown } from '../utils';

export function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
    const raw = typeof content === 'string' ? content : safeRender(content);
    const text = cleanMarkdown(raw);
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => <h1 className="text-sm font-bold text-zinc-400 mt-3 mb-1.5">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[13px] font-bold text-zinc-400 mt-2.5 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold text-zinc-500 mt-2 mb-1">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-[11px] font-semibold text-zinc-500 mt-1.5 mb-0.5">{children}</h4>,
                    p: ({ children }) => <p className="text-[11px] text-zinc-500 leading-relaxed mb-1.5">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li className="text-[11px] text-zinc-500 leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-zinc-400">{children}</strong>,
                    em: ({ children }) => <em className="italic text-zinc-500">{children}</em>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-zinc-700 pl-3 my-1.5 text-zinc-600 italic">{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) => {
                        const isInline = !codeClass;
                        return isInline
                            ? <code className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                            : <code className="block bg-zinc-900 text-zinc-400 p-2 rounded-lg text-[10px] font-mono my-1.5 overflow-x-auto">{children}</code>;
                    },
                    pre: ({ children }) => <pre className="bg-zinc-900 rounded-lg my-1.5 overflow-x-auto">{children}</pre>,
                    hr: () => <hr className="border-zinc-800 my-2" />,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-1.5">
                            <table className="min-w-full text-[10px] border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-zinc-800/50">{children}</thead>,
                    th: ({ children }) => <th className="text-left text-zinc-400 font-semibold px-2 py-1 border border-zinc-700/50">{children}</th>,
                    td: ({ children }) => <td className="text-zinc-500 px-2 py-1 border border-zinc-800/50">{children}</td>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
