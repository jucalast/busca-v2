export interface PillarWorkspaceProps {
    score: any;
    specialists: Record<string, any>;
    analysisId: string | null;
    businessId: string | null;
    profile: any;
    marketData: any;
    userProfile: { name: string; segment: string };
    onRedo: () => void;
    onStateChange?: (pillarStates: Record<string, any>, completedTasks: Record<string, Set<string>>) => void;
    initialActivePillar?: string | null;
    aiModel?: any;
    reanalysisState?: {
        isReanalyzing: boolean;
        progress?: string;
        thoughts?: string[];
    };
}

export interface TaskItem {
    id: string;
    titulo: string;
    descricao: string;
    executavel_por_ia: boolean;
    entregavel_ia?: string;
    instrucoes_usuario?: string;
    ferramenta?: string;
    ferramenta_url?: string;
    tempo_estimado?: string;
    resultado_esperado?: string;
    kpi?: string;
    prioridade?: string;
    depende_de?: string | null;
    depende_pilar?: string | null;
}
