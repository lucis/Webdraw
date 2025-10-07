/**
 * Componentes UI para mostrar status de sincronização
 */

import React from 'react';
import { useSync } from './sync-store';
import { Button } from '../../components/ui/button';
import type { SyncStatus } from './sync-types';

// ==================== ICONS ====================

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PendingIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ==================== UTILITIES ====================

const formatRelativeTime = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  
  if (diff < 1000) return 'agora';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  return `${Math.floor(diff / 3600000)}h atrás`;
};

const getStatusConfig = (status: SyncStatus) => {
  switch (status) {
    case 'idle':
      return {
        color: 'text-slate-400',
        bg: 'bg-slate-100',
        icon: null,
        text: '',
        visible: false,
      };
      
    case 'pending':
      return {
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        icon: <PendingIcon className="h-3 w-3" />,
        text: 'Alterações detectadas',
        visible: true,
      };
      
    case 'saving':
      return {
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        icon: <SpinnerIcon className="h-3 w-3" />,
        text: 'Salvando...',
        visible: true,
      };
      
    case 'saved':
      return {
        color: 'text-green-600',
        bg: 'bg-green-50',
        icon: <CheckIcon className="h-3 w-3" />,
        text: 'Salvo',
        visible: true,
      };
      
    case 'error':
      return {
        color: 'text-red-600',
        bg: 'bg-red-50',
        icon: <ErrorIcon className="h-3 w-3" />,
        text: 'Erro ao salvar',
        visible: true,
      };
      
    case 'retrying':
      return {
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        icon: <SpinnerIcon className="h-3 w-3" />,
        text: 'Tentando novamente...',
        visible: true,
      };
      
    case 'conflict':
      return {
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        icon: <ErrorIcon className="h-3 w-3" />,
        text: 'Conflito detectado',
        visible: true,
      };
      
    default:
      return {
        color: 'text-slate-400',
        bg: 'bg-slate-100',
        icon: null,
        text: 'Desconhecido',
        visible: false,
      };
  }
};

// ==================== COMPONENTS ====================

interface SyncStatusIndicatorProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  position = 'top-right',
  size = 'sm',
  showText = true,
  className = '',
}) => {
  const { status, forceSync, clearError } = useSync();
  const config = getStatusConfig(status);
  
  if (!config.visible) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`
      absolute z-50 
      ${positionClasses[position]} 
      ${config.bg} ${config.color} 
      ${sizeClasses[size]}
      rounded-full shadow-lg 
      flex items-center gap-2
      transition-all duration-200
      ${className}
    `}>
      {config.icon}
      {showText && <span className="font-medium">{config.text}</span>}
      
      {status === 'error' && (
        <Button
          size="sm"
          variant="ghost"
          className="h-4 w-4 p-0 ml-1 hover:bg-red-100"
          onClick={() => {
            clearError();
            forceSync().catch(console.error);
          }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      )}
    </div>
  );
};

interface TopBarSyncStatusProps {
  className?: string;
}

export const TopBarSyncStatus: React.FC<TopBarSyncStatusProps> = ({
  className = '',
}) => {
  const { 
    status, 
    lastSaved, 
    pendingChanges, 
    forceSync, 
    clearError,
    metrics 
  } = useSync();
  
  const config = getStatusConfig(status);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Status Indicator */}
      {config.visible && (
        <div className={`
          flex items-center gap-2 px-2 py-1 rounded-full text-xs
          ${config.bg} ${config.color}
          transition-all duration-200
        `}>
          {config.icon}
          <span className="font-medium">{config.text}</span>
          
          {status === 'error' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 ml-1 hover:bg-red-100"
              onClick={() => {
                clearError();
                forceSync().catch(console.error);
              }}
              title="Erro ao salvar. Clique para tentar novamente."
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          )}
        </div>
      )}
      
      {/* Last Saved Timestamp */}
      {lastSaved && !pendingChanges && (
        <span className="text-xs text-slate-500">
          Salvo {formatRelativeTime(lastSaved)}
        </span>
      )}
      
      {/* Force Save Button (debug) */}
      {process.env.NODE_ENV === 'development' && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => forceSync().catch(console.error)}
          title="Force save (debug)"
        >
          💾
        </Button>
      )}
      
      {/* Metrics (debug) */}
      {process.env.NODE_ENV === 'development' && metrics.totalSaves > 0 && (
        <span className="text-xs text-slate-400 font-mono">
          {metrics.totalSaves}s/{metrics.totalErrors}e/{metrics.lastSyncDuration}ms
        </span>
      )}
    </div>
  );
};

interface SyncStatusBadgeProps {
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  className = '',
}) => {
  const { status, pendingChanges } = useSync();
  
  if (status === 'idle' && !pendingChanges) {
    return null;
  }

  const config = getStatusConfig(status);
  
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
      ${config.bg} ${config.color}
      transition-all duration-200
      ${className}
    `}>
      {config.icon}
      {config.text}
    </div>
  );
};
