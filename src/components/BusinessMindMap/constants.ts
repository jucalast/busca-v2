import {
    Users, Palette, Eye, ShoppingBag, TrendingUp, Megaphone, HandCoins
} from 'lucide-react';

export const PILLAR_META: Record<string, { label: string; icon: any; color: string; ordem: number }> = {
    publico_alvo: { label: 'Público-Alvo', icon: Users, color: '#8b5cf6', ordem: 1 },
    branding: { label: 'Branding', icon: Palette, color: '#f59e0b', ordem: 2 },
    identidade_visual: { label: 'Identidade Visual', icon: Eye, color: '#ec4899', ordem: 3 },
    canais_venda: { label: 'Canais de Venda', icon: ShoppingBag, color: '#3b82f6', ordem: 4 },
    trafego_organico: { label: 'Tráfego Orgânico', icon: TrendingUp, color: '#10b981', ordem: 5 },
    trafego_pago: { label: 'Tráfego Pago', icon: Megaphone, color: '#f97316', ordem: 6 },
    processo_vendas: { label: 'Processo de Vendas', icon: HandCoins, color: '#6366f1', ordem: 7 },
};

export const PILLAR_ORDER = ['publico_alvo', 'branding', 'identidade_visual', 'canais_venda', 'trafego_organico', 'trafego_pago', 'processo_vendas'];

// ─── Layout positions for 7 pillars ───
// Distributed around center with generous spacing
// Left side: indices 0,1,2  |  Right side: 3,4,5,6
export const PILLAR_POSITIONS: { x: number; y: number; side: 'left' | 'right' }[] = [
    { x: -320, y: -220, side: 'left' },   // publico_alvo
    { x: -340, y: -30, side: 'left' },   // branding
    { x: -320, y: 160, side: 'left' },   // identidade_visual
    { x: 320, y: -260, side: 'right' },  // canais_venda
    { x: 340, y: -70, side: 'right' },  // trafego_organico
    { x: 320, y: 120, side: 'right' },  // trafego_pago
    { x: 300, y: 300, side: 'right' },  // processo_vendas
];
