'use client';

import React, { useState } from 'react';

interface OnboardingData {
    nome_negocio: string;
    segmento: string;
    cidade_estado: string;
    tempo_operacao: string;
    num_funcionarios: string;
    modelo: string;
    tipo_produto: string;
    ticket_medio: string;
    faturamento_mensal: string;
    canais_venda: string[];
    dificuldades: string;
    objetivos: string;
}

interface BusinessOnboardingProps {
    onComplete: (data: OnboardingData) => void;
    loading?: boolean;
}

const STEPS = [
    { id: 'basico', title: 'Sobre o Negócio', subtitle: 'Dados fundamentais', icon: '🏢' },
    { id: 'modelo', title: 'Modelo & Números', subtitle: 'Como você opera e fatura', icon: '💰' },
    { id: 'canais', title: 'Canais de Venda', subtitle: 'Onde você vende hoje', icon: '📡' },
    { id: 'desafios', title: 'Desafios & Objetivos', subtitle: 'O que travar e onde quer chegar', icon: '🎯' },
];

const CANAIS_OPTIONS = [
    { id: 'site', label: 'Site / E-commerce', icon: '🌐' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'marketplace', label: 'Marketplace (Shopee, ML, etc)', icon: '🛒' },
    { id: 'cold_call', label: 'Cold Call / Telefone', icon: '📞' },
    { id: 'cold_email', label: 'Cold Email / Outbound', icon: '📧' },
    { id: 'indicacao', label: 'Indicação / Boca a boca', icon: '🤝' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'loja_fisica', label: 'Loja Física', icon: '🏪' },
    { id: 'feiras', label: 'Feiras / Eventos', icon: '🎪' },
    { id: 'google_ads', label: 'Google Ads', icon: '📊' },
    { id: 'representante', label: 'Representante Comercial', icon: '👔' },
];

const MODELO_OPTIONS = [
    { value: 'B2B', label: 'B2B', desc: 'Vendo para empresas' },
    { value: 'B2C', label: 'B2C', desc: 'Vendo para consumidores' },
    { value: 'D2C', label: 'D2C', desc: 'Direto ao consumidor (marca própria)' },
    { value: 'Misto', label: 'Misto', desc: 'Vendo para empresas e consumidores' },
];

const BusinessOnboarding: React.FC<BusinessOnboardingProps> = ({ onComplete, loading = false }) => {
    const [step, setStep] = useState(0);
    const [data, setData] = useState<OnboardingData>({
        nome_negocio: '',
        segmento: '',
        cidade_estado: '',
        tempo_operacao: '',
        num_funcionarios: '',
        modelo: '',
        tipo_produto: '',
        ticket_medio: '',
        faturamento_mensal: '',
        canais_venda: [],
        dificuldades: '',
        objetivos: '',
    });

    const update = (field: keyof OnboardingData, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const toggleCanal = (canalId: string) => {
        setData(prev => ({
            ...prev,
            canais_venda: prev.canais_venda.includes(canalId)
                ? prev.canais_venda.filter(c => c !== canalId)
                : [...prev.canais_venda, canalId]
        }));
    };

    const canAdvance = (): boolean => {
        switch (step) {
            case 0: return !!(data.nome_negocio && data.segmento && data.cidade_estado);
            case 1: return !!(data.modelo && data.tipo_produto);
            case 2: return data.canais_venda.length > 0;
            case 3: return !!(data.dificuldades && data.objetivos);
            default: return false;
        }
    };

    const handleSubmit = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            onComplete(data);
        }
    };

    const inputClass = "w-full bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-all text-sm border border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
    const labelClass = "block text-sm font-medium text-zinc-400 mb-1.5";

    return (
        <div className="w-full max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    {STEPS.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => i < step ? setStep(i) : undefined}
                            className={`flex items-center gap-2 text-xs font-medium transition-all ${i === step
                                    ? 'text-emerald-400'
                                    : i < step
                                        ? 'text-zinc-400 cursor-pointer hover:text-zinc-200'
                                        : 'text-zinc-600'
                                }`}
                        >
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${i === step
                                    ? 'bg-emerald-500/20 border border-emerald-500/50'
                                    : i < step
                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                        : 'bg-zinc-900 border border-zinc-800'
                                }`}>
                                {i < step ? '✓' : s.icon}
                            </span>
                            <span className="hidden sm:inline">{s.title}</span>
                        </button>
                    ))}
                </div>
                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-lime-500 rounded-full transition-all duration-500"
                        style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Step Content */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-lime-500" />

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="text-2xl">{STEPS[step].icon}</span>
                        {STEPS[step].title}
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">{STEPS[step].subtitle}</p>
                </div>

                {/* Step 0: Basic Info */}
                {step === 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className={labelClass}>Nome do negócio *</label>
                            <input
                                type="text"
                                value={data.nome_negocio}
                                onChange={e => update('nome_negocio', e.target.value)}
                                placeholder="Ex: Embalagens São Paulo"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Segmento / Nicho *</label>
                            <input
                                type="text"
                                value={data.segmento}
                                onChange={e => update('segmento', e.target.value)}
                                placeholder="Ex: fabricação de embalagens de papelão ondulado"
                                className={inputClass}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Cidade / Estado *</label>
                                <input
                                    type="text"
                                    value={data.cidade_estado}
                                    onChange={e => update('cidade_estado', e.target.value)}
                                    placeholder="Ex: Guarulhos, SP"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Tempo de operação</label>
                                <input
                                    type="text"
                                    value={data.tempo_operacao}
                                    onChange={e => update('tempo_operacao', e.target.value)}
                                    placeholder="Ex: 5 anos"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Nº de funcionários</label>
                            <input
                                type="text"
                                value={data.num_funcionarios}
                                onChange={e => update('num_funcionarios', e.target.value)}
                                placeholder="Ex: 12"
                                className={inputClass}
                            />
                        </div>
                    </div>
                )}

                {/* Step 1: Business Model */}
                {step === 1 && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className={labelClass}>Modelo de negócio *</label>
                            <div className="grid grid-cols-2 gap-3">
                                {MODELO_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => update('modelo', opt.value)}
                                        className={`p-3 rounded-xl border text-left transition-all ${data.modelo === opt.value
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm">{opt.label}</p>
                                        <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>O que você oferece? *</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { v: 'produto', l: 'Produto', i: '📦' },
                                    { v: 'servico', l: 'Serviço', i: '🔧' },
                                    { v: 'ambos', l: 'Ambos', i: '🔄' },
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        onClick={() => update('tipo_produto', opt.v)}
                                        className={`p-3 rounded-xl border text-center transition-all ${data.tipo_produto === opt.v
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                    >
                                        <span className="text-xl">{opt.i}</span>
                                        <p className="text-sm font-medium mt-1">{opt.l}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Ticket médio</label>
                                <input
                                    type="text"
                                    value={data.ticket_medio}
                                    onChange={e => update('ticket_medio', e.target.value)}
                                    placeholder="Ex: R$ 3.500"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Faturamento mensal</label>
                                <input
                                    type="text"
                                    value={data.faturamento_mensal}
                                    onChange={e => update('faturamento_mensal', e.target.value)}
                                    placeholder="Ex: R$ 80.000"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Sales Channels */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <label className={labelClass}>Selecione todos os canais que você usa atualmente *</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {CANAIS_OPTIONS.map(canal => (
                                <button
                                    key={canal.id}
                                    onClick={() => toggleCanal(canal.id)}
                                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all text-sm ${data.canais_venda.includes(canal.id)
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                                        }`}
                                >
                                    <span className="text-lg">{canal.icon}</span>
                                    <span className="font-medium">{canal.label}</span>
                                </button>
                            ))}
                        </div>
                        {data.canais_venda.length > 0 && (
                            <p className="text-xs text-emerald-400 mt-2">
                                ✓ {data.canais_venda.length} canal(is) selecionado(s)
                            </p>
                        )}
                    </div>
                )}

                {/* Step 3: Challenges & Goals */}
                {step === 3 && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className={labelClass}>
                                Quais são suas maiores dificuldades? *
                            </label>
                            <p className="text-xs text-zinc-600 mb-2">
                                Descreva livremente: vendas, precificação, concorrência, marketing, equipe...
                            </p>
                            <textarea
                                value={data.dificuldades}
                                onChange={e => update('dificuldades', e.target.value)}
                                placeholder="Ex: Não consigo prospectar clientes novos, dependo muito de indicação. Acho que meu preço está alto comparado com concorrentes chineses. Não sei usar marketing digital..."
                                className={`${inputClass} resize-none min-h-[120px]`}
                                rows={5}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                Onde você quer chegar? *
                            </label>
                            <p className="text-xs text-zinc-600 mb-2">
                                Objetivos para os próximos 3, 6 ou 12 meses.
                            </p>
                            <textarea
                                value={data.objetivos}
                                onChange={e => update('objetivos', e.target.value)}
                                placeholder="Ex: Dobrar o faturamento em 12 meses, conseguir contratos recorrentes com indústrias, entrar em novos mercados..."
                                className={`${inputClass} resize-none min-h-[100px]`}
                                rows={4}
                            />
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/50">
                    <button
                        onClick={() => setStep(Math.max(0, step - 1))}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${step === 0
                                ? 'text-zinc-700 cursor-not-allowed'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        disabled={step === 0}
                    >
                        ← Voltar
                    </button>

                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                        {step + 1} de {STEPS.length}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!canAdvance() || loading}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${!canAdvance() || loading
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : step === STEPS.length - 1
                                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 text-black hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                            }`}
                    >
                        {loading
                            ? '🧠 Analisando...'
                            : step === STEPS.length - 1
                                ? '🚀 Gerar Diagnóstico'
                                : 'Próximo →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BusinessOnboarding;
