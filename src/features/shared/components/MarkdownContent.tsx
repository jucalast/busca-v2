import React from 'react';
import ReactMarkdown from 'react-markdown';
import { safeRender, cleanMarkdown } from '@/features/workspace/components/pillar-workspace/utils';

export function MarkdownContent({ 
    content, 
    className = '', 
    variant = 'default' 
}: { 
    content: string; 
    className?: string; 
    variant?: 'default' | 'small' | 'tiny'
}) {
    const raw = typeof content === 'string' ? content : safeRender(content);
    const text = cleanMarkdown(raw);
    
    const isSmall = variant === 'small' || variant === 'tiny';

    return (
        <div className={`markdown-content ${className} select-text text-left ${isSmall ? 'text-[11px]' : ''}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => <h1 className={`${isSmall ? 'text-[13px]' : 'text-[24px]'} font-bold mt-6 mb-3 tracking-tight`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-primary)' }}>{children}</h1>,
                    h2: ({ children }) => <h2 className={`${isSmall ? 'text-[12px]' : 'text-[22px]'} font-bold mt-5 mb-2.5 tracking-tight`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-secondary)' }}>{children}</h2>,
                    h3: ({ children }) => <h3 className={`${isSmall ? 'text-[11px]' : 'text-[20px]'} font-bold mt-4 mb-2 tracking-tight`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-muted)' }}>{children}</h3>,
                    h4: ({ children }) => <h4 className={`${isSmall ? 'text-[11px]' : 'text-[18px]'} font-semibold mt-3 mb-1.5`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-muted)' }}>{children}</h4>,
                    p: ({ children }) => <p className={`${isSmall ? 'text-[11px]' : 'text-[19px]'} leading-[1.6] mb-4 font-normal`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-secondary)' }}>{children}</p>,
                    ul: ({ children }) => <ul className={`list-disc list-outside pl-5 mb-4 ${isSmall ? 'space-y-1' : 'space-y-2'}`}>{children}</ul>,
                    ol: ({ children }) => <ol className={`list-decimal list-outside pl-5 mb-4 ${isSmall ? 'space-y-1' : 'space-y-2'}`}>{children}</ol>,
                    li: ({ children }) => <li className={`${isSmall ? 'text-[11px]' : 'text-[19px]'} leading-[1.6]`} style={{ color: isSmall ? 'inherit' : 'var(--color-text-secondary)' }}>{children}</li>,
                    strong: ({ children }) => <strong className="font-bold" style={{ color: isSmall ? 'inherit' : 'var(--color-text-primary)' }}>{children}</strong>,
                    em: ({ children }) => <em className="italic opacity-80" style={{ color: isSmall ? 'inherit' : 'var(--color-text-muted)' }}>{children}</em>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                            className="underline underline-offset-4 decoration-2 decoration-blue-500/30 hover:decoration-blue-500 transition-all font-medium"
                            style={{ color: isSmall ? 'inherit' : 'var(--color-accent)' }}
                        >
                            {children}
                        </a>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 pl-4 my-6 italic rounded-r-md py-1" style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)', color: 'inherit' }}>{children}</blockquote>
                    ),
                    code: ({ children, className: codeClass }) => {
                        const isInline = !codeClass;
                        return isInline
                            ? <code className="px-1.5 py-0.5 rounded-md text-[10px] font-mono" style={{ backgroundColor: 'var(--color-surface-1)', color: 'inherit' }}>{children}</code>
                            : <code className="block p-4 rounded-xl text-[10px] font-mono my-4 overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-1)', color: 'inherit' }}>{children}</code>;
                    },
                    pre: ({ children }) => <pre className="rounded-xl my-4 overflow-x-auto border" style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>{children}</pre>,
                    hr: () => <hr className="my-6" style={{ borderColor: 'var(--color-border)' }} />,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="min-w-full text-[10px] border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead style={{ backgroundColor: 'var(--color-surface-1)' }}>{children}</thead>,
                    th: ({ children }) => <th className="text-left font-bold px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', color: 'inherit' }}>{children}</th>,
                    td: ({ children }) => <td className="px-4 py-3 border-b font-normal" style={{ borderColor: 'var(--color-border)', color: 'inherit' }}>{children}</td>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
