'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface SearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder = 'Search...' }: SearchBoxProps) {
    return (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#1c1c1e' }}>
            <Search className="w-[15px] h-[15px] flex-shrink-0" style={{ color: '#88888e' }} />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent border-none outline-none text-[14px] text-white placeholder:text-[#88888e]"
                style={{ fontFamily: "'Inter', sans-serif" }}
            />
        </div>
    );
}
