/**
 * Sistema de Sincronização Bidirecional - WebDraw
 * 
 * Sistema completo para gerenciar sincronização entre local e remoto:
 * - Local → Remote: Auto-save com debounce
 * - Remote → Local: Watcher/polling (futuro)
 * 
 * Uso:
 * 
 * ```typescript
 * // 1. Inicializar sync no app
 * const { initializeSync, scheduleSync } = useSync();
 * 
 * useEffect(() => {
 *   initializeSync({
 *     updateDrawing: (id, data) => client.UPDATE_DRAWING({ drawingId: id, ...data }),
 *     getCurrentDrawingId: () => currentDrawing?.id || null,
 *   });
 * }, []);
 * 
 * // 2. Usar no canvas
 * const { scheduleSync } = useSync();
 * 
 * const handleChange = useCallback(() => {
 *   scheduleSync({ elements, appState, files });
 * }, [scheduleSync]);
 * 
 * // 3. Mostrar status na UI
 * <TopBarSyncStatus />
 * ```
 */

import type { DrawingData } from './sync-types';

// ==================== CORE EXPORTS ====================

export { SyncManager, createSyncManager } from './sync-manager';
export { useSyncStore, useSync } from './sync-store';
export { 
  SyncStatusIndicator, 
  TopBarSyncStatus, 
  SyncStatusBadge 
} from './sync-components';

// ==================== TYPE EXPORTS ====================

export type {
  SyncStatus,
  WatchStatus,
  DrawingData,
  SyncState,
  WatchState,
  BidirectionalSyncState,
  SyncConfig,
  WatchConfig,
  SyncQueueItem,
  SyncMetrics,
} from './sync-types';

// ==================== UTILITIES ====================

/**
 * Helper para criar configuração de sync padrão
 */
export const createSyncConfig = (
  apiClient: {
    updateDrawing: (id: string, data: DrawingData) => Promise<void>;
    getCurrentDrawingId: () => string | null;
  }
) => {
  return apiClient;
};

// ==================== FUTURE EXPORTS (Preparado para Watcher) ====================

/**
 * TODO: Implementar quando necessário
 * 
 * export { WatchManager } from './watch-manager';
 * export { ConflictResolver } from './conflict-resolver'; 
 * export { MergeEngine } from './merge-engine';
 * export { RemoteChangeIndicator } from './remote-components';
 * 
 * export const createWatchConfig = (apiClient: WatchApiClient) => WatchConfig;
 * export const createBidirectionalSync = (syncConfig, watchConfig) => BidirectionalSyncManager;
 */
