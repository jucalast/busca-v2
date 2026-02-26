export interface BusinessMindMapProps {
    score: any;
    specialists: Record<string, any>;
    marketData: any;
    pillarStates: Record<string, any>;
    completedTasks: Record<string, Set<string>>;
    userProfile: { name: string; segment: string };
}

export interface Position {
    x: number;
    y: number;
}
