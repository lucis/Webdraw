/**
 * Zustand Store dedicado ao sistema de sincronização
 * 
 * Integra com SyncManager para fornecer estado global type-safe
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SyncManager, createSyncManager } from './sync-manager';
import type { SyncStatus, DrawingData, SyncConfig, SyncMetrics } from './sync-types';

interface SyncStoreState {
  // ==================== STATE ====================
  
  /** Status atual da sincronização */
  status: SyncStatus;
  
  /** Última data de salvamento */
  lastSaved: Date | null;
  
  /** Última mensagem de erro */
  lastError: string | null;
  
  /** Se há mudanças pendentes */
  pendingChanges: boolean;
  
  /** Se está online */
  isOnline: boolean;
  
  /** Manager instance (internal) */
  manager: SyncManager | null;
  
  /** Métricas de performance */
  metrics: SyncMetrics;
  
  // ==================== ACTIONS ====================
  
  /**
   * Inicializa o sistema de sync com configuração
   */
  initializeSync: (apiClient: SyncConfig['apiClient']) => void;
  
  /**
   * Agenda uma sincronização (com debounce)
   */
  scheduleSync: (data: DrawingData) => void;
  
  /**
   * Força sincronização imediata
   */
  forceSync: () => Promise<void>;
  
  /**
   * Pausa sincronização temporariamente
   */
  pauseSync: () => void;
  
  /**
   * Retoma sincronização
   */
  resumeSync: () => void;
  
  /**
   * Limpa erro atual
   */
  clearError: () => void;
  
  /**
   * Atualiza status (chamada internamente pelo manager)
   */
  updateStatus: (status: SyncStatus) => void;
  
  /**
   * Atualiza última data de salvamento
   */
  updateLastSaved: (date: Date) => void;
  
  /**
   * Atualiza erro
   */
  updateError: (error: string) => void;
  
  /**
   * Cleanup - deve ser chamado ao desmontar
   */
  cleanup: () => void;

  // ==================== WATCHER METHODS (FUTURO) ====================

  /**
   * Inicia monitoramento de mudanças remotas
   * TODO: Implementar quando necessário
   */
  startWatcher: () => void;

  /**
   * Para monitoramento de mudanças remotas
   * TODO: Implementar quando necessário
   */
  stopWatcher: () => void;

  /**
   * Força verificação de mudanças remotas
   * TODO: Implementar quando necessário
   */
  checkRemoteChanges: () => Promise<boolean>;

  /**
   * Configura intervalo de polling
   * TODO: Implementar quando necessário
   */
  setPollingInterval: (ms: number) => void;
}

export const useSyncStore = create<SyncStoreState>()(
  devtools(
    (set, get) => ({
      // ==================== INITIAL STATE ====================
      
      status: 'idle',
      lastSaved: null,
      lastError: null,
      pendingChanges: false,
      isOnline: navigator.onLine,
      manager: null,
      metrics: {
        totalSaves: 0,
        totalErrors: 0,
        averageLatency: 0,
        lastSyncDuration: 0,
      },
      
      // ==================== ACTIONS ====================
      
      initializeSync: (apiClient) => {
        // Cleanup existing manager if any
        const currentManager = get().manager;
        if (currentManager) {
          currentManager.destroy();
        }

        // Create new manager with callbacks
        const manager = createSyncManager(apiClient);
        
        // Setup manager callbacks to update store
        const config = {
          ...manager['config'], // Access private config
          onStatusChange: (status: SyncStatus) => {
            set({ status });
            
            // Update pending changes flag
            const pendingChanges = status === 'pending' || status === 'saving' || status === 'retrying';
            set({ pendingChanges });
          },
          
          onSuccess: () => {
            set({ 
              lastSaved: new Date(),
              lastError: null,
              metrics: get().manager?.getMetrics() || get().metrics,
            });
          },
          
          onError: (error: Error) => {
            set({ 
              lastError: error.message,
              metrics: get().manager?.getMetrics() || get().metrics,
            });
          },
        };
        
        // Update manager config
        Object.assign(manager['config'], config);

        set({ manager });
        
        console.log('✅ SyncManager initialized');
      },
      
      scheduleSync: (data) => {
        const manager = get().manager;
        if (!manager) {
          console.warn('SyncStore: Manager not initialized');
          return;
        }
        
        manager.scheduleSync(data);
      },
      
      forceSync: async () => {
        const manager = get().manager;
        if (!manager) {
          throw new Error('SyncManager not initialized');
        }
        
        return manager.forceSync();
      },
      
      pauseSync: () => {
        const manager = get().manager;
        if (manager) {
          manager.pauseSync();
        }
      },
      
      resumeSync: () => {
        const manager = get().manager;
        if (manager) {
          manager.resumeSync();
        }
      },
      
      clearError: () => {
        set({ lastError: null });
      },
      
      updateStatus: (status) => {
        set({ status });
        
        // Update pending changes flag
        const pendingChanges = status === 'pending' || status === 'saving' || status === 'retrying';
        set({ pendingChanges });
      },
      
      updateLastSaved: (date) => {
        set({ lastSaved: date });
      },
      
      updateError: (error) => {
        set({ lastError: error });
      },
      
      cleanup: () => {
        const manager = get().manager;
        if (manager) {
          manager.destroy();
        }
        
        set({
          manager: null,
          status: 'idle',
          lastError: null,
          pendingChanges: false,
        });
        
        console.log('🧹 SyncManager cleaned up');
      },

      // ==================== WATCHER ACTIONS (FUTURO) ====================

      startWatcher: () => {
        const manager = get().manager;
        if (manager) {
          manager.startWatcher();
        }
        console.log('👁️ SyncStore: Watcher será implementado no futuro');
      },

      stopWatcher: () => {
        const manager = get().manager;
        if (manager) {
          manager.stopWatcher();
        }
      },

      checkRemoteChanges: async () => {
        const manager = get().manager;
        if (!manager) {
          return false;
        }
        
        return manager.checkRemoteChanges();
      },

      setPollingInterval: (ms: number) => {
        // TODO: Implementar configuração de intervalo de polling
        console.log(`🔄 SyncStore: setPollingInterval(${ms}) será implementado no futuro`);
      },
    }),
    { name: 'SyncStore' }
  )
);

/**
 * Hook de conveniência para usar o sync store
 */
export const useSync = () => {
  const store = useSyncStore();
  
  return {
    // Estado
    status: store.status,
    lastSaved: store.lastSaved,
    lastError: store.lastError,
    pendingChanges: store.pendingChanges,
    isOnline: store.isOnline,
    metrics: store.metrics,
    
    // Ações principais (Local → Remote)
    scheduleSync: store.scheduleSync,
    forceSync: store.forceSync,
    
    // Controle
    pauseSync: store.pauseSync,
    resumeSync: store.resumeSync,
    clearError: store.clearError,
    
    // Watcher actions (Remote → Local) - FUTURO
    startWatcher: store.startWatcher,
    stopWatcher: store.stopWatcher,
    checkRemoteChanges: store.checkRemoteChanges,
    setPollingInterval: store.setPollingInterval,
    
    // Lifecycle
    initializeSync: store.initializeSync,
    cleanup: store.cleanup,
    
    // Status helpers
    isIdle: store.status === 'idle',
    isPending: store.status === 'pending',
    isSaving: store.status === 'saving',
    isSaved: store.status === 'saved',
    hasError: store.status === 'error',
    isRetrying: store.status === 'retrying',
  };
};
