'use client';

import React from 'react';
import { ChevronRight, Check, Circle, Loader2, Zap } from 'lucide-react';
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
    baseIcon = <img src="/forms.svg" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Forms" />;
  } else if (tool.includes('docs') || tool.includes('document')) {
    baseIcon = <img src="/docs.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Docs" />;
  } else if (tool.includes('sheets') || tool.includes('planilha') || tool.includes('calendario') || tool.includes('cronograma') || tool.includes('matriz')) {
    baseIcon = <img src="/sheets.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Sheets" />;
  } else if (tool.includes('canva')) {
    baseIcon = <img src="/canva.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Canva" />;
  } else if (tool.includes('excel')) {
    baseIcon = <img src="/excel.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Excel" />;
  } else if (tool.includes('linkedin')) {
    baseIcon = <img src="/linkedin.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="LinkedIn" />;
  } else if (tool.includes('instagram')) {
    baseIcon = <img src="/instagram.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Instagram" />;
  } else if (tool.includes('facebook') || tool.includes('fb') || tool.includes('library')) {
    baseIcon = <img src="/facebook.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Facebook" />;
  } else if (tool.includes('trends')) {
    baseIcon = <img src="/trends.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Trends" />;
  } else if (tool.includes('ads') || tool.includes('gerenciador') || tool.includes('campanha')) {
    baseIcon = <Zap size={16} className="shrink-0" style={{ color: 'var(--color-warning)' }} />;
  } else if (tool.includes('google') || tool.includes('search')) {
    baseIcon = <img src="/google.png" className="w-[24px] h-[24px] rounded shrink-0 object-contain shadow-sm" alt="Google" />;
  } else if (task.executavel_por_ia) {
    const modelInfo =
      aiModel === 'gemini' ? { img: '/gemini.png', label: 'Gemini' } :
        aiModel === 'groq' ? { img: '/groq llama.svg', label: 'Groq' } :
          aiModel === 'sambanova' ? { img: '/sambanova.png', label: 'SambaNova' } :
            aiModel === 'deepseek' ? { img: '/deepseek.png', label: 'DeepSeek' } :
              aiModel === 'cerebras' ? { img: '/cerebras.png', label: 'Cerebras' } :
                { img: '/openrouter.png', label: 'OpenRouter' };
    baseIcon = (
      <img
        src={modelInfo.img}
        className="w-[24px] h-[24px] rounded-lg shrink-0 object-contain shadow-sm"
        alt={modelInfo.label}
        style={{ filter: aiModel === 'groq' ? 'none' : 'none' }} // Groq doesn't need invert in light mode
      />
    );
  } else {
    baseIcon = <Circle size={16} className="shrink-0" style={{ color: 'var(--color-border-strong)' }} />;
  }

  return (
    <div className="relative">
      {baseIcon}
      {isDone && (
        <div
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md border-2 border-white"
          style={{ backgroundColor: 'var(--color-success)' }}
        >
          <Check className="w-2 h-2 text-white" strokeWidth={4} />
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
    <div className={`group transition-all duration-400 ease-out ${shouldHide ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[12px] border transition-all duration-200 cursor-pointer ${isFocused ? 'task-card-leave pointer-events-none' : ''
          } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
        style={{
          backgroundColor: isExpanded ? 'var(--color-surface-active)' : 'transparent',
          borderColor: isExpanded ? 'var(--color-border-strong)' : 'transparent',
          boxShadow: isExpanded ? 'var(--shadow-sm)' : 'none',
        }}
        onMouseEnter={e => {
          if (!isExpanded) {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }
        }}
        onMouseLeave={e => {
          if (!isExpanded) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          {taskIcon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-2 w-full text-left">
            <span
              className={`text-[13px] font-semibold leading-snug transition-colors duration-200 ${(isDone || isSubtaskLoading)
                ? 'text-[--color-text-primary]'
                : 'text-[--color-text-secondary] group-hover:text-[--color-text-primary]'
                }`}
            >
              {task.titulo}
            </span>
          </div>

          <div
            className={`flex items-center gap-2 whitespace-nowrap overflow-hidden text-left transition-opacity duration-200 ${(isDone || isSubtaskLoading) ? 'opacity-80' : 'opacity-40 group-hover:opacity-80'
              }`}
          >
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>#{index + 1}</span>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {isAI ? 'Inteligência Artificial' : 'Ação Manual'}
            </span>
            {task.prioridade && (
              <>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>•</span>
                <span className="text-[11px] font-medium capitalize" style={{
                  color: task.prioridade === 'critica' ? 'var(--color-destructive)' :
                    task.prioridade === 'alta' ? 'var(--color-warning)' :
                      'var(--color-text-tertiary)'
                }}>
                  {task.prioridade}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 transition-all duration-200" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* Subtask progress card */}
      {currentSubtask && (
        <div className="mt-2 pl-11">
          <div
            className="relative overflow-hidden transition-colors rounded-[10px] flex items-center gap-3 px-3 py-2 w-full glass-card"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center relative z-10">
              {currentSubtask.status === 'waiting' && <Circle size={12} style={{ color: 'var(--color-text-muted)' }} />}
              {currentSubtask.status === 'running' && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-accent)' }} />}
              {currentSubtask.status === 'done' && <Check size={12} style={{ color: 'var(--color-success)' }} />}
              {currentSubtask.status === 'error' && <Circle size={12} style={{ color: 'var(--color-destructive)' }} />}
            </div>

            <span
              className="text-[12px] font-medium truncate flex-1 relative z-10"
              style={{
                color: currentSubtask.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                textDecoration: currentSubtask.status === 'done' ? 'line-through' : 'none',
              }}
            >
              {currentSubtask.titulo}
            </span>

            {currentSubtask.status === 'running' && (
              <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40 px-2 relative z-10" style={{ color: 'var(--color-accent)' }}>Processando</span>
            )}
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

