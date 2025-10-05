/**
 * Gerenciador de estado do Excalidraw
 * 
 * Esta classe encapsula toda a lógica de interação com a API imperativa
 * do Excalidraw, incluindo:
 * - Carregar/salvar desenhos
 * - Auto-save
 * - Exportação
 * - Estatísticas
 */

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawElement,
} from "../types/drawing";
import { drawingStorage } from "./storage";

/**
 * Configurações de auto-save
 */
const AUTO_SAVE_DELAY = 2000; // 2 segundos

/**
 * Classe para gerenciar o estado do Excalidraw
 */
export class ExcalidrawStateManager {
  private api: ExcalidrawImperativeAPI | null = null;
  private autoSaveTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Inicializa o gerenciador com a API do Excalidraw
   */
  initialize(api: ExcalidrawImperativeAPI) {
    this.api = api;
    this.isInitialized = true;
  }

  /**
   * Verifica se a API está inicializada
   */
  private ensureInitialized() {
    if (!this.api || !this.isInitialized) {
      throw new Error("API do Excalidraw não inicializada");
    }
  }

  /**
   * Carrega um desenho no canvas
   */
  async loadDrawing(drawingId: string): Promise<void> {
    this.ensureInitialized();

    const drawing = await drawingStorage.getDrawing(drawingId);
    if (!drawing) {
      throw new Error(`Desenho não encontrado: ${drawingId}`);
    }

    // Atualizar estado do Excalidraw
    this.api!.updateScene({
      elements: drawing.elements as ExcalidrawElement[],
      appState: drawing.appState,
    });

    // Carregar arquivos (imagens, etc)
    if (drawing.files && Object.keys(drawing.files).length > 0) {
      this.api!.addFiles(Object.values(drawing.files));
    }

    // Marcar como desenho atual
    await drawingStorage.setCurrentDrawingId(drawingId);
  }

  /**
   * Cria um novo desenho e carrega no canvas
   */
  async createNewDrawing(name: string): Promise<string> {
    this.ensureInitialized();

    // Criar novo desenho vazio
    const drawing = await drawingStorage.createDrawing(name);

    // Limpar canvas
    this.api!.updateScene({
      elements: [],
      appState: {},
    });

    // Marcar como desenho atual
    await drawingStorage.setCurrentDrawingId(drawing.id);

    return drawing.id;
  }

  /**
   * Salva o estado atual do canvas
   */
  async saveCurrentState(): Promise<void> {
    this.ensureInitialized();

    const elements = this.api!.getSceneElements();
    const appState = this.api!.getAppState();
    const files = this.api!.getFiles();

    await drawingStorage.saveCurrentDrawing(elements, appState, files);
  }

  /**
   * Agenda um auto-save (debounced)
   */
  scheduleAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.saveCurrentState().catch((error) => {
        console.error("Erro no auto-save:", error);
      });
    }, AUTO_SAVE_DELAY);
  }

  /**
   * Exporta o desenho atual como imagem
   */
  async exportAsImage(type: "png" | "svg" = "png"): Promise<Blob> {
    this.ensureInitialized();

    const elements = this.api!.getSceneElements();
    const appState = this.api!.getAppState();
    const files = this.api!.getFiles();

    // Usar API nativa do Excalidraw para exportar
    const blob = await this.api!.exportToBlob({
      elements,
      appState,
      files,
      mimeType: type === "png" ? "image/png" : "image/svg+xml",
    });

    return blob;
  }

  /**
   * Exporta o desenho atual como JSON
   */
  async exportAsJSON(): Promise<string> {
    this.ensureInitialized();

    const elements = this.api!.getSceneElements();
    const appState = this.api!.getAppState();
    const files = this.api!.getFiles();

    return JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "webdraw",
      elements,
      appState,
      files,
    }, null, 2);
  }

  /**
   * Obtém estatísticas do desenho atual
   */
  getDrawingStats() {
    if (!this.api || !this.isInitialized) return null;

    const elements = this.api.getSceneElements();
    
    return {
      totalElements: elements.length,
      elementTypes: elements.reduce((acc: Record<string, number>, el: any) => {
        acc[el.type] = (acc[el.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Limpa o canvas
   */
  clearCanvas(): void {
    this.ensureInitialized();
    
    this.api!.updateScene({
      elements: [],
      appState: {},
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.api = null;
    this.isInitialized = false;
  }
}
