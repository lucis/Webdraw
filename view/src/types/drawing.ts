/**
 * Tipos para gerenciamento de desenhos no Webdraw
 */

// Imports do Excalidraw - usar any por enquanto até resolver tipos
export type ExcalidrawElement = any;
export type AppState = any;
export type BinaryFiles = Record<string, any>;
export type ExcalidrawImperativeAPI = any;

/**
 * Representa um desenho completo com seus elementos e estado
 */
export interface Drawing {
  id: string;
  name: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Dados serializados para persistência
 */
export interface SerializedDrawing {
  id: string;
  name: string;
  data: string; // JSON stringificado
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Lista de desenhos (metadados apenas)
 */
export interface DrawingMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // Base64 data URL
}

/**
 * Operações de storage disponíveis
 * NOTA: Esta interface será 1:1 com os tools do servidor no futuro
 */
export interface DrawingStorage {
  // Create
  createDrawing(name: string, initialData?: Partial<Drawing>): Promise<Drawing>;
  
  // Read
  getDrawing(id: string): Promise<Drawing | null>;
  getCurrentDrawing(): Promise<Drawing | null>;
  listDrawings(): Promise<DrawingMetadata[]>;
  
  // Update
  updateDrawing(id: string, data: Partial<Drawing>): Promise<Drawing>;
  saveCurrentDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles
  ): Promise<void>;
  
  // Delete
  deleteDrawing(id: string): Promise<void>;
  
  // State management
  setCurrentDrawingId(id: string | null): Promise<void>;
  getCurrentDrawingId(): Promise<string | null>;
}

