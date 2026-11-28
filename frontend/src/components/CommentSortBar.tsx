import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { CommentSortMode } from '../utils/commentSort';

interface CommentSortBarProps {
  sortMode: CommentSortMode;
  onChange: (mode: CommentSortMode) => void;
  language: string;
  compact?: boolean;
}

export const CommentSortBar: React.FC<CommentSortBarProps> = ({
  sortMode,
  onChange,
  language,
  compact = false
}) => {
  const isEs = language === 'es';
  const options: { id: CommentSortMode; label: string }[] = [
    { id: 'relevance', label: isEs ? 'Relevancia' : 'Relevance' },
    { id: 'newest', label: isEs ? 'Más recientes' : 'Newest' }
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.4rem',
        marginBottom: compact ? '0.35rem' : '0.6rem'
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: compact ? '0.72rem' : '0.78rem',
          color: 'var(--text-muted)',
          marginRight: '0.15rem'
        }}
      >
        <ArrowUpDown size={compact ? 11 : 12} />
        {isEs ? 'Ordenar:' : 'Sort:'}
      </span>
      {options.map(opt => {
        const active = sortMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              padding: compact ? '0.18rem 0.55rem' : '0.25rem 0.7rem',
              borderRadius: '999px',
              fontSize: compact ? '0.73rem' : '0.78rem',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: active ? 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' : 'var(--bg-secondary)',
              color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
