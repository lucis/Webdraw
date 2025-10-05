/**
 * Abstração de persistência para desenhos
 * 
 * Esta camada abstrai completamente a persistência, permitindo trocar
 * a implementação (localStorage → IndexedDB → Server) sem afetar o resto da aplicação.
 * 
 * IMPORTANTE: A API é desenhada para ser 1:1 com os tools do servidor no futuro.
 * Quando a API backend estiver pronta, será só trocar a implementação.
 */

import type {
  Drawing,
  SerializedDrawing,
  DrawingMetadata,
  DrawingStorage,
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from "../types/drawing";

/**
 * Chaves do localStorage
 */
const STORAGE_KEYS = {
  DRAWINGS: "webdraw:drawings",
  CURRENT_DRAWING_ID: "webdraw:current-drawing-id",
  DRAWING_PREFIX: "webdraw:drawing:",
} as const;

/**
 * Implementação de storage usando localStorage
 * 
 * NOTA: Esta implementação será substituída por chamadas de tools no futuro
 * A API é desenhada para ser 1:1 com os tools do servidor
 */
class LocalStorageDrawingStorage implements DrawingStorage {
  
  /**
   * Gera um ID único para um desenho
   */
  private generateId(): string {
    return `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serializa um desenho para armazenamento
   */
  private serializeDrawing(drawing: Drawing): SerializedDrawing {
    return {
      id: drawing.id,
      name: drawing.name,
      data: JSON.stringify({
        elements: drawing.elements,
        appState: drawing.appState,
        files: drawing.files,
      }),
      createdAt: drawing.createdAt,
      updatedAt: drawing.updatedAt,
      version: drawing.version,
    };
  }

  /**
   * Desserializa um desenho do armazenamento
   */
  private deserializeDrawing(serialized: SerializedDrawing): Drawing {
    const data = JSON.parse(serialized.data);
    return {
      id: serialized.id,
      name: serialized.name,
      elements: data.elements || [],
      appState: data.appState || {},
      files: data.files || {},
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
      version: serialized.version,
    };
  }

  /**
   * Obtém chave de storage para um desenho específico
   */
  private getDrawingKey(id: string): string {
    return `${STORAGE_KEYS.DRAWING_PREFIX}${id}`;
  }

  /**
   * Cria um novo desenho
   * Futuro: Mapeará para tool CREATE_DRAWING
   */
  async createDrawing(name: string, initialData?: Partial<Drawing>): Promise<Drawing> {
    const now = Date.now();
    const drawing: Drawing = {
      id: this.generateId(),
      name,
      elements: initialData?.elements || [],
      appState: initialData?.appState || {},
      files: initialData?.files || {},
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Salvar desenho
    const serialized = this.serializeDrawing(drawing);
    localStorage.setItem(this.getDrawingKey(drawing.id), JSON.stringify(serialized));

    // Atualizar lista de desenhos
    const metadata = await this.listDrawings();
    metadata.push({
      id: drawing.id,
      name: drawing.name,
      createdAt: drawing.createdAt,
      updatedAt: drawing.updatedAt,
    });
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(metadata));

    return drawing;
  }

  /**
   * Obtém um desenho por ID
   * Futuro: Mapeará para tool GET_DRAWING
   */
  async getDrawing(id: string): Promise<Drawing | null> {
    const data = localStorage.getItem(this.getDrawingKey(id));
    if (!data) return null;

    try {
      const serialized: SerializedDrawing = JSON.parse(data);
      return this.deserializeDrawing(serialized);
    } catch (error) {
      console.error("Erro ao desserializar desenho:", error);
      return null;
    }
  }

  /**
   * Obtém o desenho atualmente selecionado
   * Futuro: Mapeará para tool GET_CURRENT_DRAWING
   */
  async getCurrentDrawing(): Promise<Drawing | null> {
    const currentId = await this.getCurrentDrawingId();
    if (!currentId) return null;
    return this.getDrawing(currentId);
  }

  /**
   * Lista todos os desenhos (metadados apenas)
   * Futuro: Mapeará para tool LIST_DRAWINGS
   */
  async listDrawings(): Promise<DrawingMetadata[]> {
    const data = localStorage.getItem(STORAGE_KEYS.DRAWINGS);
    if (!data) return [];

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Erro ao listar desenhos:", error);
      return [];
    }
  }

  /**
   * Atualiza um desenho existente
   * Futuro: Mapeará para tool UPDATE_DRAWING
   */
  async updateDrawing(id: string, data: Partial<Drawing>): Promise<Drawing> {
    const existing = await this.getDrawing(id);
    if (!existing) {
      throw new Error(`Desenho não encontrado: ${id}`);
    }

    const updated: Drawing = {
      ...existing,
      ...data,
      id: existing.id, // ID não pode mudar
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    // Salvar desenho atualizado
    const serialized = this.serializeDrawing(updated);
    localStorage.setItem(this.getDrawingKey(id), JSON.stringify(serialized));

    // Atualizar metadados na lista
    const allDrawings = await this.listDrawings();
    const index = allDrawings.findIndex((d) => d.id === id);
    if (index >= 0) {
      allDrawings[index] = {
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
      localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(allDrawings));
    }

    return updated;
  }

  /**
   * Salva o estado atual do desenho
   * Futuro: Mapeará para tool SAVE_CURRENT_DRAWING
   */
  async saveCurrentDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void> {
    const currentId = await this.getCurrentDrawingId();
    if (!currentId) {
      throw new Error("Nenhum desenho selecionado para salvar");
    }

    await this.updateDrawing(currentId, {
      elements,
      appState,
      files,
    });
  }

  /**
   * Deleta um desenho
   * Futuro: Mapeará para tool DELETE_DRAWING
   */
  async deleteDrawing(id: string): Promise<void> {
    // Remover desenho
    localStorage.removeItem(this.getDrawingKey(id));

    // Atualizar lista
    const allDrawings = await this.listDrawings();
    const filtered = allDrawings.filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(filtered));

    // Se era o desenho atual, limpar seleção
    const currentId = await this.getCurrentDrawingId();
    if (currentId === id) {
      await this.setCurrentDrawingId(null);
    }
  }

  /**
   * Define o ID do desenho atual
   * Futuro: Mapeará para tool SET_CURRENT_DRAWING
   */
  async setCurrentDrawingId(id: string | null): Promise<void> {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAWING_ID);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_DRAWING_ID, id);
    }
  }

  /**
   * Obtém o ID do desenho atual
   * Futuro: Mapeará para tool GET_CURRENT_DRAWING_ID
   */
  async getCurrentDrawingId(): Promise<string | null> {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_DRAWING_ID);
  }
}

/**
 * Instância singleton do storage
 * 
 * IMPORTANTE: No futuro, este será substituído por uma implementação
 * que chama os tools do servidor via RPC
 */
export const drawingStorage: DrawingStorage = new LocalStorageDrawingStorage();
