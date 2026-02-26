export function truncate(str: string, max: number) {
    if (!str) return '';
    const s = typeof str === 'string' ? str : JSON.stringify(str);
    return s.length > max ? s.slice(0, max) + '…' : s;
}

export function scoreColor(s: number) {
    if (s >= 70) return '#34d399';
    if (s >= 40) return '#fbbf24';
    return '#f87171';
}

export function scoreBg(s: number) {
    if (s >= 70) return 'rgba(52,211,153,0.12)';
    if (s >= 40) return 'rgba(251,191,36,0.12)';
    return 'rgba(248,113,113,0.12)';
}

// Smooth bezier curve from parent to child
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
    const cpx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`;
}
