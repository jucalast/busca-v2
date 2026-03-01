'use client';

import React from 'react';
import { ChevronRight, Check, Circle, Loader2 } from 'lucide-react';
import { TaskItem } from '@/features/workspace/components/pillar-workspace/types';

interface TaskCardProps {
  task: TaskItem;
  index: number;
  isDone: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isAI: boolean;
  onClick: () => void;
  aiModel?: string;
  children?: React.ReactNode;
  shouldHide?: boolean; // Nova prop para controlar se o card deve ser escondido
  disabled?: boolean;
  // Sub-tasks props
  currentSubtask?: {
    titulo: string;
    status: 'waiting' | 'running' | 'done' | 'error';
  };
  isSubtaskLoading?: boolean;
}

// Import the same icon logic from PillarWorkspace
const getTaskIcon = (task: TaskItem, isDone: boolean, aiModel?: string) => {
  const tool = (task.ferramenta || '').toLowerCase();
  let baseIcon = null;

  if (tool.includes('docs') || tool.includes('document')) {
    baseIcon = <img src="/docs.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Docs" />;
  } else if (tool.includes('sheets') || tool.includes('planilha')) {
    baseIcon = <img src="/sheets.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Sheets" />;
  } else if (tool.includes('canva')) {
    baseIcon = <img src="/canva.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Canva" />;
  } else if (tool.includes('excel')) {
    baseIcon = <img src="/excel.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Excel" />;
  } else if (tool.includes('google') || tool.includes('search')) {
    baseIcon = <img src="/google.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Google" />;
  } else if (task.executavel_por_ia) {
    const modelInfo =
      aiModel === 'gemini' ? { img: '/gemini.png', label: 'Gemini' } :
      aiModel === 'groq' ? { img: '/groq llama.png', label: 'Groq' } :
      { img: '/openrouter.png', label: 'OpenRouter' };
    baseIcon = <img src={modelInfo.img} className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt={modelInfo.label} />;
  } else {
    baseIcon = <Circle className="w-[26px] h-[26px] text-zinc-800" />;
  }

  return (
    <div className="relative">
      {baseIcon}
      {isDone && (
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-none">
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
        </div>
      )}
    </div>
  );
};

export default function TaskCard({
  task,
  index,
  isDone,
  isExpanded,
  isFocused,
  isAI,
  onClick,
  aiModel,
  children,
  shouldHide = false,
  disabled = false,
  currentSubtask,
  isSubtaskLoading = false
}: TaskCardProps) {
  const taskIcon = getTaskIcon(task, isDone, aiModel);

  // Debug para verificar se as props estão chegando
  console.log('TaskCard Debug:', {
    taskTitle: task.titulo,
    currentSubtask,
    isSubtaskLoading
  });

  return (
    <div className={`group transition-all duration-500 ease-out ${shouldHide ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 ease-out cursor-pointer ${
          isExpanded ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
        } ${isFocused ? 'task-card-leave pointer-events-none' : ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          {taskIcon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-2 w-full text-left">
            <span className={`text-[13px] font-medium truncate ${
              isExpanded ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'
            }`}>
              {task.titulo}
            </span>
            {isDone && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-left">
            <span className="text-[11px] text-zinc-600">#{index + 1}</span>
            <span className="text-[11px] text-zinc-600">
              {isAI ? 'Inteligência Artificial' : 'Ações Manuais'}
            </span>
            {task.prioridade && (
              <>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className={`text-[11px] ${
                  task.prioridade === 'critica' ? 'text-red-500/50' : 
                  task.prioridade === 'alta' ? 'text-amber-500/50' : 
                  'text-zinc-600'
                }`}>
                  {task.prioridade}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </button>
      
      {/* Subtask card simples com efeito shimmer */}
      {currentSubtask && (
        <div className="mt-2">
          <style>{`
            @keyframes subtask-shimmer {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
          <div className="flex flex-col gap-1 w-full">
            <div className="relative overflow-hidden transition-colors rounded-lg flex items-center gap-3 px-3 w-full hover:bg-white/[0.04] border border-transparent hover:border-white/[0.02]">
              {/* Shimmer effect */}
              {currentSubtask.status === 'running' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '50%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                    animation: 'subtask-shimmer 1.6s ease-in-out infinite',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
              )}
              
              <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center relative z-10">
                {currentSubtask.status === 'waiting' && <Circle className="w-3.5 h-3.5 text-zinc-600" />}
                {currentSubtask.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
                {currentSubtask.status === 'done' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                {currentSubtask.status === 'error' && <Circle className="w-3.5 h-3.5 text-red-500" />}
              </div>

              <span className={`text-[12px] font-medium truncate flex-1 relative z-10 ${
                currentSubtask.status === 'done' 
                  ? 'text-zinc-500 line-through decoration-zinc-800' 
                  : currentSubtask.status === 'running' 
                    ? 'text-zinc-300' 
                    : 'text-zinc-300'
              }`}>
                {currentSubtask.titulo}
              </span>

              {currentSubtask.status === 'running' && (
                <span className="text-[9px] font-medium text-violet-400 animate-pulse px-2 relative z-10">Executando...</span>
              )}

              {currentSubtask.status === 'error' && (
                <span className="text-[9px] font-medium text-red-400 px-2 relative z-10">Falhou</span>
              )}
            </div>
          </div>
        </div>
      )}
      
      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
