import React from 'react';
import ReactMarkdown from 'react-markdown';
import { safeRender, cleanMarkdown } from '@/features/workspace/components/pillar-workspace/utils';

export function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
    const raw = typeof content === 'string' ? content : safeRender(content);
    const text = cleanMarkdown(raw);
    return (
        <div className={`markdown-content ${className} select-text text-left`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => <h1 className="text-[17px] font-bold mt-6 mb-3 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[15px] font-bold mt-5 mb-2.5 tracking-tight" style={{ color: 'var(--color-text-secondary)' }}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[13px] font-bold mt-4 mb-2 tracking-tight" style={{ color: 'var(--color-text-muted)' }}>{children}</h3>,
                    h4: ({ children }) => <h4 className="text-[12px] font-semibold mt-3 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{children}</h4>,
                    p: ({ children }) => <p className="text-[15px] leading-[1.6] mb-4 font-normal" style={{ color: 'var(--color-text-secondary)' }}>{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-4 space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-4 space-y-2">{children}</ol>,
                    li: ({ children }) => <li className="text-[15px] leading-[1.6]" style={{ color: 'var(--color-text-secondary)' }}>{children}</li>,
                    strong: ({ children }) => <strong className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>,
                    em: ({ children }) => <em className="italic opacity-80" style={{ color: 'var(--color-text-muted)' }}>{children}</em>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="underline underline-offset-4 decoration-2 decoration-blue-500/30 hover:decoration-blue-500 transition-all font-medium"
                            style={{ color: 'var(--color-accent)' }}
                        >
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 pl-4 my-6 italic rounded-r-md bg-black/5 py-1" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) => {
                        const isInline = !codeClass;
                        return isInline
                            ? <code className="px-1.5 py-0.5 rounded-md text-[12px] font-mono bg-black/5" style={{ color: 'var(--color-text-primary)' }}>{children}</code>
                            : <code className="block p-4 rounded-xl text-[12px] font-mono my-4 overflow-x-auto bg-black/5" style={{ color: 'var(--color-text-primary)' }}>{children}</code>;
                    },
                    pre: ({ children }) => <pre className="rounded-xl my-4 overflow-x-auto bg-black/5 border border-black/5">{children}</pre>,
                    hr: () => <hr className="my-6 border-black/10" />,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border border-black/5">
                            <table className="min-w-full text-[12px] border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-black/5">{children}</thead>,
                    th: ({ children }) => <th className="text-left font-bold px-4 py-3 border-b border-black/5" style={{ color: 'var(--color-text-primary)' }}>{children}</th>,
                    td: ({ children }) => <td className="px-4 py-3 border-b border-black/5 font-normal" style={{ color: 'var(--color-text-secondary)' }}>{children}</td>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
