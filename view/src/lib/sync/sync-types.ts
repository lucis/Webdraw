/**
 * Types e interfaces para o sistema de sincronização
 */

export type SyncStatus = 
  | 'idle'          // Nenhuma operação pendente
  | 'pending'       // Mudanças detectadas, aguardando debounce
  | 'saving'        // Salvando no servidor
  | 'saved'         // Salvo com sucesso (transitório)
  | 'error'         // Erro ao salvar
  | 'retrying'      // Tentando novamente
  | 'conflict';     // Conflito detectado

export interface DrawingData {
  elements: readonly any[];
  appState: Record<string, any>;
  files: Record<string, any>;
}

export interface SyncState {
  status: SyncStatus;
  lastSaved: Date | null;
  lastError: string | null;
  retryCount: number;
  pendingChanges: boolean;
  isOnline: boolean;
}

export interface SyncConfig {
  // Timing
  debounceMs: number;          // 2000ms default
  maxRetries: number;          // 3 default
  retryDelayMs: number;        // 1000ms default
  
  // Callbacks
  onStatusChange?: (status: SyncStatus) => void;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
  
  // API client
  apiClient: {
    updateDrawing: (id: string, data: DrawingData) => Promise<void>;
    getCurrentDrawingId: () => string | null;
  };
}

export interface SyncQueueItem {
  id: string;
  data: DrawingData;
  timestamp: Date;
  attempts: number;
}

export interface SyncMetrics {
  totalSaves: number;
  totalErrors: number;
  averageLatency: number;
  lastSyncDuration: number;
}

// ==================== WATCHER TYPES (FUTURO) ====================

export type WatchStatus =
  | 'idle'          // Sem mudanças remotas
  | 'watching'      // Monitorando mudanças remotas
  | 'detected'      // Mudança remota detectada
  | 'fetching'      // Buscando versão remota
  | 'merging'       // Fazendo merge das mudanças
  | 'applied'       // Mudanças aplicadas (transitório)
  | 'conflict'      // Conflito requer intervenção manual
  | 'error';        // Erro ao buscar/aplicar

export interface WatchState {
  status: WatchStatus;
  remoteVersion: number;
  localVersion: number;
  lastChecked: Date | null;
  lastRemoteChange: Date | null;
  conflictData?: {
    localChanges: DrawingData;
    remoteChanges: DrawingData;
    baseVersion: number;
  };
}

export interface WatchConfig {
  // Estratégia
  strategy: 'polling-version' | 'polling-metadata' | 'websocket' | 'sse';
  
  // Timing (para polling)
  pollingInterval: number;      // 5000ms default
  pollingWhenIdle: number;      // 30000ms when no activity
  
  // Controle
  enabled: boolean;             // true default
  pauseWhenTyping: boolean;     // true default
  
  // Callbacks
  onRemoteChange?: (remoteData: DrawingData, remoteVersion: number) => void;
  onConflict?: (local: DrawingData, remote: DrawingData) => void;
  onAutoMerged?: (mergedData: DrawingData) => void;
  
  // API client for remote data
  apiClient: {
    getDrawingMetadata: (id: string) => Promise<{ version: number; updatedAt: Date }>;
    getDrawing: (id: string) => Promise<DrawingData & { version: number }>;
  };
}

export interface BidirectionalSyncState {
  // Estados de sync local
  sync: {
    status: SyncStatus;
    lastSaved: Date | null;
    lastError: string | null;
    retryCount: number;
    pendingChanges: boolean;
    isOnline: boolean;
    metrics: SyncMetrics;
  };
  
  // Estados de watcher remoto (FUTURO)
  watch: WatchState;
  
  // Controle geral
  isCollaborating: boolean;
  collaborators: string[];
  
  // Configurações
  pollingEnabled: boolean;
  pollingInterval: number;
}
