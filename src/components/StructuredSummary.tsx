import React from 'react';

interface StructuredSummaryProps {
    data: any;
    depth?: number;
}

const StructuredSummary: React.FC<StructuredSummaryProps> = ({ data, depth = 0 }) => {
    if (!data) return null;

    // Handle strings (paragraphs)
    if (typeof data === 'string') {
        return (
            <p className="text-zinc-300 leading-relaxed mb-4 text-sm md:text-base">
                {data}
            </p>
        );
    }

    // Handle arrays (lists)
    if (Array.isArray(data)) {
        return (
            <ul className="list-none space-y-3 mb-6 pl-2">
                {data.map((item, index) => (
                    <li key={index} className="flex gap-3 text-zinc-300 items-start group">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors flex-shrink-0" />
                        <div className="flex-1">
                            <StructuredSummary data={item} depth={depth + 1} />
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    // Handle objects (sections)
    if (typeof data === 'object') {
        return (
            <div className={`space-y-6 ${depth > 0 ? 'ml-4 md:ml-6 border-l border-zinc-800/50 pl-4 md:pl-6' : ''}`}>
                {Object.entries(data).map(([key, value]) => {
                    // Skip if value is empty/null
                    if (!value && value !== 0) return null;

                    // Format key title (camelCase/snake_case to Title Case)
                    const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();

                    return (
                        <div key={key} className="relative group">
                            {/* Specialized rendering for specific keys can be added here */}

                            {/* Section Header */}
                            <div className="flex items-center gap-3 mb-3">
                                {depth === 0 && (
                                    <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-lime-400 rounded-sm" />
                                )}
                                <h3 className={`font-medium tracking-wide ${depth === 0
                                        ? 'text-lg text-white uppercase tracking-wider'
                                        : 'text-base text-zinc-100'
                                    }`}>
                                    {title}
                                </h3>
                            </div>

                            {/* Content */}
                            <div className="text-zinc-400">
                                <StructuredSummary data={value} depth={depth + 1} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return null;
};

export default StructuredSummary;
