import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface CopyEmailButtonProps {
  email: string;
  iconSize?: number;
  style?: React.CSSProperties;
}

export const CopyEmailButton: React.FC<CopyEmailButtonProps> = ({
  email,
  iconSize = 13,
  style
}) => {
  const { language } = useTranslation();
  const isEs = language === 'es';
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = email;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? (isEs ? '¡Copiado!' : 'Copied!') : (isEs ? `Copiar ${email}` : `Copy ${email}`)}
      aria-label={copied ? (isEs ? '¡Copiado!' : 'Copied!') : (isEs ? `Copiar ${email}` : `Copy ${email}`)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem',
        background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
        border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
        color: copied ? '#10b981' : 'var(--text-secondary)',
        borderRadius: 6,
        padding: '0.2rem 0.45rem',
        marginLeft: '0.45rem',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 500,
        verticalAlign: 'middle',
        transition: 'all 0.2s ease',
        ...style
      }}
      onMouseEnter={e => {
        if (!copied) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!copied) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }
      }}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      {copied && <span>{isEs ? '¡Copiado!' : 'Copied!'}</span>}
    </button>
  );
};

export default CopyEmailButton;
