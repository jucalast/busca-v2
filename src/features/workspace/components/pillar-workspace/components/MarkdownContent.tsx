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
                    h1: ({ children }) => <h1 className="text-sm font-bold mt-3 mb-1.5" style={{ color: 'var(--color-text-primary)' }}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[13px] font-bold mt-2.5 mb-1" style={{ color: 'var(--color-text-secondary)' }}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-1" style={{ color: 'var(--color-text-muted)' }}>{children}</h3>,
                    h4: ({ children }) => <h4 className="text-[11px] font-semibold mt-1.5 mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{children}</h4>,
                    p: ({ children }) => <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>,
                    em: ({ children }) => <em className="italic" style={{ color: 'var(--color-text-muted)' }}>{children}</em>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="underline underline-offset-2 transition-colors"
                            style={{ color: 'var(--color-accent)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent-muted)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-accent)'}
                        >
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 pl-3 my-1.5 italic" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) => {
                        const isInline = !codeClass;
                        return isInline
                            ? <code className="px-1 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}>{children}</code>
                            : <code className="block p-2 rounded-lg text-[10px] font-mono my-1.5 overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}>{children}</code>;
                    },
                    pre: ({ children }) => <pre className="rounded-lg my-1.5 overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-hover)' }}>{children}</pre>,
                    hr: () => <hr className="my-2" style={{ borderColor: 'var(--color-border)' }} />,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-1.5">
                            <table className="min-w-full text-[10px] border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead style={{ backgroundColor: 'var(--color-surface-hover)' }}>{children}</thead>,
                    th: ({ children }) => <th className="text-left font-semibold px-2 py-1 border" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{children}</th>,
                    td: ({ children }) => <td className="px-2 py-1 border" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>{children}</td>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
