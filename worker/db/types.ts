export interface DrawingScene {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export interface UserRow {
  id: string;
  openRouterUserId: string;
  interfaceModel: string | null;
  drawingModel: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialRow {
  userId: string;
  ciphertext: string;
  iv: string;
  formatVersion: number;
  updatedAt: number;
}

export interface SessionUserRow {
  id: string;
  openRouterUserId: string;
}

export interface FolderRow {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  order: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingRow {
  id: string;
  userId: string;
  folderId: string;
  name: string;
  scene: DrawingScene;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export class RepositoryError extends Error {
  constructor(readonly code: "not_found" | "version_conflict" | "default_folder") {
    super(code);
    this.name = "RepositoryError";
  }
}
