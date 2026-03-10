'use client';

import { useState, useEffect, useRef } from 'react';

interface PersistableState {
    completedTasks: Record<string, Set<string>>;
    taskDeliverables: Record<string, any>;
    taskSubtasks: Record<string, any>;
    autoExecSubtasks: Record<string, any[]>;
    autoExecResults: Record<string, Record<number, any>>;
    autoExecStatuses: Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>;
    pillarStates: Record<string, any>;
    selectedTaskAiModel?: string;
}

interface UseLocalStoragePersistenceProps {
    analysisId: string | null;
    currentAiModel: string;
    state: PersistableState;
    setters: {
        setPillarStates: React.Dispatch<React.SetStateAction<Record<string, any>>>;
        setTaskDeliverables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
        setTaskSubtasks: React.Dispatch<React.SetStateAction<Record<string, any>>>;
        setAutoExecuting: React.Dispatch<React.SetStateAction<string | null>>;
        setAutoExecStep: React.Dispatch<React.SetStateAction<number>>;
        setAutoExecTotal: React.Dispatch<React.SetStateAction<number>>;
        setAutoExecLog: React.Dispatch<React.SetStateAction<string[]>>;
        setAutoExecSubtasks: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
        setAutoExecResults: React.Dispatch<React.SetStateAction<Record<string, Record<number, any>>>>;
        setAutoExecStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<number, 'waiting' | 'running' | 'done' | 'error'>>>>;
        setCompletedTasks: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
        setExpandedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
        setShowKPIs: React.Dispatch<React.SetStateAction<boolean>>;
        setSelectedTaskAiModel: React.Dispatch<React.SetStateAction<string>>;
        setError: React.Dispatch<React.SetStateAction<string>>;
    };
    defaultTaskAiModel: string;
}

export function useLocalStoragePersistence({
    analysisId,
    currentAiModel,
    state,
    setters,
    defaultTaskAiModel,
}: UseLocalStoragePersistenceProps) {
    const prevAnalysisIdRef = useRef<string | null | undefined>(undefined);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const analysisIdForSaveRef = useRef<string | null>(analysisId);

    const {
        setPillarStates, setTaskDeliverables, setTaskSubtasks,
        setAutoExecuting, setAutoExecStep, setAutoExecTotal, setAutoExecLog,
        setAutoExecSubtasks, setAutoExecResults, setAutoExecStatuses,
        setCompletedTasks, setExpandedTaskIds, setShowKPIs, setSelectedTaskAiModel, setError,
    } = setters;

    // Combined load / reset effect
    useEffect(() => {
        if (!analysisId) return;

        const previousAnalysisId = prevAnalysisIdRef.current;
        const isFirstMount = previousAnalysisId === undefined;
        const isReanalysis = !isFirstMount && previousAnalysisId !== analysisId;
        prevAnalysisIdRef.current = analysisId;

        if (isReanalysis) {
            setPillarStates({});
            setTaskDeliverables({});
            setTaskSubtasks({});
            setAutoExecuting(null);
            setAutoExecStep(0);
            setAutoExecTotal(0);
            setAutoExecLog([]);
            setAutoExecSubtasks({});
            setAutoExecResults({});
            setAutoExecStatuses({});
            setCompletedTasks({});
            setExpandedTaskIds(new Set());
            setShowKPIs(false);
            setSelectedTaskAiModel(defaultTaskAiModel);
            setError('');
            setIsStorageLoaded(true);

            if (previousAnalysisId) {
                localStorage.removeItem(`pillar_workspace_${previousAnalysisId}`);
            }
            localStorage.removeItem(`pillar_workspace_${analysisId}`);
            analysisIdForSaveRef.current = analysisId;
        } else if (isFirstMount) {
            console.log('🏗️ Initial mount for analysis:', analysisId);
        }
    }, [analysisId, currentAiModel]);

    // First mount: load persisted state from localStorage
    useEffect(() => {
        if (!analysisId) return;

        try {
            const saved = localStorage.getItem(`pillar_workspace_${analysisId}`);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.completedTasks) {
                    const restored: Record<string, Set<string>> = {};
                    for (const [k, v] of Object.entries(data.completedTasks)) {
                        restored[k] = new Set(v as string[]);
                    }
                    setCompletedTasks(restored);
                }
                if (data.taskDeliverables) setTaskDeliverables(data.taskDeliverables);
                if (data.taskSubtasks) setTaskSubtasks(data.taskSubtasks);
                if (data.autoExecSubtasks) setAutoExecSubtasks(data.autoExecSubtasks);
                if (data.autoExecResults) setAutoExecResults(data.autoExecResults);
                if (data.autoExecStatuses) setAutoExecStatuses(data.autoExecStatuses);
                if (data.pillarStates) setPillarStates(data.pillarStates);
                if (data.selectedTaskAiModel) setSelectedTaskAiModel(data.selectedTaskAiModel);
            }
        } catch (e) {
            console.warn('Failed to load persisted state:', e);
        }
        setIsStorageLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    // Keep analysisIdForSaveRef current
    useEffect(() => {
        analysisIdForSaveRef.current = analysisId;
    }, [analysisId]);

    // Save state to localStorage on changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const currentId = analysisIdForSaveRef.current;
        if (!currentId || !isStorageLoaded) return;
        const hasData = Object.keys(state.completedTasks).length > 0 ||
            Object.keys(state.taskDeliverables).length > 0 ||
            Object.keys(state.pillarStates).length > 0;
        if (!hasData) return;

        try {
            const ct: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(state.completedTasks)) {
                ct[k] = Array.from(v);
            }
            localStorage.setItem(`pillar_workspace_${currentId}`, JSON.stringify({
                completedTasks: ct,
                taskDeliverables: state.taskDeliverables,
                taskSubtasks: state.taskSubtasks,
                autoExecSubtasks: state.autoExecSubtasks,
                autoExecResults: state.autoExecResults,
                autoExecStatuses: state.autoExecStatuses,
                pillarStates: state.pillarStates,
                selectedTaskAiModel: state.selectedTaskAiModel,
            }));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }, [state.completedTasks, state.taskDeliverables, state.taskSubtasks, state.autoExecSubtasks, state.autoExecResults, state.autoExecStatuses, state.pillarStates, state.selectedTaskAiModel, isStorageLoaded]);

    return { isStorageLoaded };
}
