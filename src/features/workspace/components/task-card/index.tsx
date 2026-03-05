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
  shouldHide?: boolean;
  disabled?: boolean;
  currentSubtask?: {
    titulo: string;
    status: 'waiting' | 'running' | 'done' | 'error';
  };
  isSubtaskLoading?: boolean;
}

const getTaskIcon = (task: TaskItem, isDone: boolean, aiModel?: string) => {
  const tool = (task.ferramenta || '').toLowerCase();
  let baseIcon = null;

  if (tool.includes('formulario') || tool.includes('pesquisa_online') || tool.includes('forms') || tool.includes('enquete') || tool.includes('survey')) {
    baseIcon = <img src="/forms.svg" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Forms" />;
  } else if (tool.includes('docs') || tool.includes('document')) {
    baseIcon = <img src="/docs.png" className="w-[26px] h-[26px] rounded shrink-0 object-contain" alt="Docs" />;
  } else if (tool.includes('sheets') || tool.includes('planilha') || tool.includes('calendario') || tool.includes('cronograma') || tool.includes('matriz')) {
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
    baseIcon = <Circle className="w-[26px] h-[26px]" style={{ color: 'var(--color-border-strong)' }} />;
  }

  return (
    <div className="relative">
      {baseIcon}
      {isDone && (
        <div
          className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-lg border-none"
          style={{ backgroundColor: 'var(--color-success)' }}
        >
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
        </div>
      )}
    </div>
  );
};

export default function TaskCard({
  task, index, isDone, isExpanded, isFocused, isAI, onClick,
  aiModel, children, shouldHide = false, disabled = false,
  currentSubtask, isSubtaskLoading = false
}: TaskCardProps) {
  const taskIcon = getTaskIcon(task, isDone, aiModel);

  return (
    <div className={`group transition-all duration-500 ease-out ${shouldHide ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${isFocused ? 'task-card-leave pointer-events-none' : ''
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        style={{
          backgroundColor: isExpanded ? 'var(--color-surface-active)' : 'transparent',
        }}
        onMouseEnter={e => {
          if (!isExpanded) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
        }}
        onMouseLeave={e => {
          if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          {taskIcon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-2 w-full text-left">
            <span
              className="text-[13px] font-medium leading-snug transition-colors duration-150"
              style={{
                color: isExpanded ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              {task.titulo}
            </span>
            {isDone && <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />}
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-left">
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>#{index + 1}</span>
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {isAI ? 'Inteligência Artificial' : 'Ações Manuais'}
            </span>
            {task.prioridade && (
              <>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                <span className="text-[11px]" style={{
                  color: task.prioridade === 'critica'
                    ? 'var(--color-destructive)'
                    : task.prioridade === 'alta'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-muted)'
                }}>
                  {task.prioridade}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 transition-colors duration-150" style={{ color: 'var(--color-text-muted)' }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </button>

      {/* Subtask shimmer card */}
      {currentSubtask && (
        <div className="mt-2">
          <style>{`
            @keyframes subtask-shimmer {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
          <div className="flex flex-col gap-1 w-full">
            <div
              className="relative overflow-hidden transition-colors rounded-lg flex items-center gap-3 px-3 w-full"
              style={{
                backgroundColor: currentSubtask.status === 'running' ? 'var(--color-surface-hover)' : 'transparent',
                border: '1px solid var(--color-border)',
              }}
            >
              {currentSubtask.status === 'running' && (
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                    animation: 'subtask-shimmer 1.6s ease-in-out infinite',
                    pointerEvents: 'none', zIndex: 0,
                  }}
                />
              )}

              <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center relative z-10">
                {currentSubtask.status === 'waiting' && <Circle className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />}
                {currentSubtask.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />}
                {currentSubtask.status === 'done' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
                {currentSubtask.status === 'error' && <Circle className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} />}
              </div>

              <span
                className="text-[12px] font-medium truncate flex-1 relative z-10"
                style={{
                  color: currentSubtask.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  textDecoration: currentSubtask.status === 'done' ? 'line-through' : 'none',
                }}
              >
                {currentSubtask.titulo}
              </span>

              {currentSubtask.status === 'running' && (
                <span className="text-[9px] font-medium animate-pulse px-2 relative z-10" style={{ color: 'var(--color-accent)' }}>Executando...</span>
              )}
              {currentSubtask.status === 'error' && (
                <span className="text-[9px] font-medium px-2 relative z-10" style={{ color: 'var(--color-destructive)' }}>Falhou</span>
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
