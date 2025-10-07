/**
 * SyncManager - Classe principal de gerenciamento de sincronização
 * 
 * Responsabilidades ATUAIS (Local → Remote):
 * - Debounce de mudanças locais
 * - Queue de operações de save
 * - Retry logic para failures
 * - Status management
 * - Error handling
 * 
 * Responsabilidades FUTURAS (Remote → Local):
 * - Polling de mudanças remotas
 * - Detecção de conflitos
 * - Auto-merge quando possível
 * - Notificação de mudanças remotas
 * - Gestão de colaboração multi-usuário
 */

import type { 
  SyncConfig, 
  SyncStatus, 
  DrawingData, 
  SyncQueueItem,
  SyncMetrics 
} from './sync-types';

export class SyncManager {
  private config: SyncConfig;
  
  // ==================== LOCAL → REMOTE (Auto-Save) ====================
  private debounceTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private queue: SyncQueueItem[] = [];
  private currentStatus: SyncStatus = 'idle';
  private isProcessing = false;
  
  // Metrics
  private metrics: SyncMetrics = {
    totalSaves: 0,
    totalErrors: 0,
    averageLatency: 0,
    lastSyncDuration: 0,
  };

  // ==================== REMOTE → LOCAL (Watcher) - FUTURO ====================
  // TODO: Implementar quando necessário
  private pollingTimer: NodeJS.Timeout | null = null;
  private _watchEnabled = false;  // Prefixo _ para variáveis futuras não usadas
  private _lastKnownVersion = 0;
  
  // NOTA: Estas propriedades serão utilizadas quando implementarmos o watcher:
  // - pollingTimer: Para polling periódico de mudanças remotas
  // - watchEnabled: Flag para habilitar/desabilitar watcher
  // - lastKnownVersion: Para detectar mudanças de versão remotas

  constructor(config: SyncConfig) {
    this.config = config;
    this.setupOnlineDetection();
  }

  /**
   * Agenda uma sincronização com debounce
   */
  scheduleSync(data: DrawingData): void {
    const currentDrawingId = this.config.apiClient.getCurrentDrawingId();
    
    if (!currentDrawingId) {
      console.warn('SyncManager: No current drawing ID, skipping sync');
      return;
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Update status to pending
    this.updateStatus('pending');

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.addToQueue(currentDrawingId, data);
      this.processQueue();
    }, this.config.debounceMs);
  }

  /**
   * Força sincronização imediata
   */
  async forceSync(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    return this.processQueue();
  }

  /**
   * Pausa sincronização
   */
  pauseSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Retoma sincronização
   */
  resumeSync(): void {
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Obtém status atual
   */
  getStatus(): SyncStatus {
    return this.currentStatus;
  }

  /**
   * Obtém métricas
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  // ==================== WATCHER METHODS (FUTURO) ====================
  
  /**
   * Inicia watcher para mudanças remotas
   * TODO: Implementar quando necessário
   */
  startWatcher(): void {
    // TODO: Implementar polling/websocket para detectar mudanças remotas
    this._watchEnabled = true;
    console.log('🔄 SyncManager: Watcher será implementado no futuro');
  }

  /**
   * Para watcher
   * TODO: Implementar quando necessário
   */
  stopWatcher(): void {
    // TODO: Parar polling/websocket
    this._watchEnabled = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Força verificação de mudanças remotas
   * TODO: Implementar quando necessário
   */
  async checkRemoteChanges(): Promise<boolean> {
    // TODO: Implementar verificação de versão remota
    console.log('🔄 SyncManager: checkRemoteChanges será implementado no futuro');
    return false;
  }

  // ==================== LIFECYCLE ====================

  /**
   * Cleanup completo
   */
  destroy(): void {
    // Cleanup auto-save
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.queue = [];
    
    // Cleanup watcher (futuro)
    this.stopWatcher();
    
    console.log('🧹 SyncManager destroyed');
  }

  // ==================== PRIVATE METHODS ====================

  private addToQueue(drawingId: string, data: DrawingData): void {
    // Remove duplicates for same drawing
    this.queue = this.queue.filter(item => item.id !== drawingId);
    
    // Add new item
    this.queue.push({
      id: drawingId,
      data: { ...data }, // Clone data
      timestamp: new Date(),
      attempts: 0,
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue[0];
      const success = await this.syncItem(item);
      
      if (success) {
        // Remove from queue
        this.queue.shift();
        this.updateStatus('saved');
        
        // Transition back to idle after 2s
        setTimeout(() => {
          if (this.currentStatus === 'saved') {
            this.updateStatus('idle');
          }
        }, 2000);
        
      } else {
        // Handle retry logic
        item.attempts++;
        
        if (item.attempts >= this.config.maxRetries) {
          // Max retries reached, remove from queue
          this.queue.shift();
          this.updateStatus('error');
          this.config.onError?.(new Error(`Max retries reached for drawing ${item.id}`));
        } else {
          // Schedule retry
          this.updateStatus('retrying');
          this.retryTimer = setTimeout(() => {
            this.processQueue();
          }, this.config.retryDelayMs);
          break; // Stop processing queue until retry
        }
      }
    }
    
    this.isProcessing = false;
    
    // Update status to idle if queue is empty
    if (this.queue.length === 0 && this.currentStatus !== 'saved') {
      this.updateStatus('idle');
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      this.updateStatus('saving');
      
      await this.config.apiClient.updateDrawing(item.id, item.data);
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.totalSaves++;
      this.metrics.lastSyncDuration = duration;
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.totalSaves - 1) + duration) / 
        this.metrics.totalSaves;
      
      this.config.onSuccess?.();
      return true;
      
    } catch (error) {
      console.error('SyncManager: Sync failed for item', item.id, error);
      
      this.metrics.totalErrors++;
      this.config.onError?.(error as Error);
      
      return false;
    }
  }

  private updateStatus(status: SyncStatus): void {
    if (this.currentStatus === status) return;
    
    this.currentStatus = status;
    this.config.onStatusChange?.(status);
  }

  private setupOnlineDetection(): void {
    // Simple online/offline detection
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      
      if (isOnline && this.queue.length > 0) {
        // Back online, process pending queue
        this.processQueue();
      } else if (!isOnline && this.currentStatus === 'saving') {
        // Went offline while saving
        this.updateStatus('error');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }
}

/**
 * Factory para criar SyncManager com configuração padrão
 */
export const createSyncManager = (apiClient: SyncConfig['apiClient']): SyncManager => {
  return new SyncManager({
    debounceMs: 2000,
    maxRetries: 3,
    retryDelayMs: 1000,
    apiClient,
  });
};
