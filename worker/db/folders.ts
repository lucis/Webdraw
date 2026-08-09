import { RepositoryError, type FolderRow } from "./types";

interface FolderDatabaseRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  sort_order: number;
  is_default: number;
  created_at: number;
  updated_at: number;
}

export interface CreateFolderInput {
  name: string;
  emoji: string;
}

export interface UpdateFolderInput {
  name?: string;
  emoji?: string;
  order?: number;
}

export async function listFolders(db: D1Database, userId: string): Promise<FolderRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, name, emoji, sort_order, is_default, created_at, updated_at
       FROM folders WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .bind(userId)
    .all<FolderDatabaseRow>();

  return result.results.map(mapFolder);
}

export async function getFolder(db: D1Database, userId: string, folderId: string): Promise<FolderRow | null> {
  const folder = await db
    .prepare(
      `SELECT id, user_id, name, emoji, sort_order, is_default, created_at, updated_at
       FROM folders WHERE id = ? AND user_id = ?`,
    )
    .bind(folderId, userId)
    .first<FolderDatabaseRow>();

  return folder ? mapFolder(folder) : null;
}

export async function createFolder(
  db: D1Database,
  userId: string,
  input: CreateFolderInput,
): Promise<FolderRow> {
  const now = Date.now();
  const folder = await db
    .prepare(
      `INSERT INTO folders (id, user_id, name, emoji, sort_order, is_default, created_at, updated_at)
       SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order) + 1, 1), 0, ?, ?
       FROM folders WHERE user_id = ?
       RETURNING id, user_id, name, emoji, sort_order, is_default, created_at, updated_at`,
    )
    .bind(crypto.randomUUID(), userId, input.name, input.emoji, now, now, userId)
    .first<FolderDatabaseRow>();

  if (!folder) {
    throw new RepositoryError("not_found");
  }

  return mapFolder(folder);
}

export async function updateFolder(
  db: D1Database,
  userId: string,
  folderId: string,
  input: UpdateFolderInput,
): Promise<FolderRow> {
  const folder = await db
    .prepare(
      `UPDATE folders
       SET name = COALESCE(?, name),
           emoji = COALESCE(?, emoji),
           sort_order = COALESCE(?, sort_order),
           updated_at = ?
       WHERE id = ? AND user_id = ?
       RETURNING id, user_id, name, emoji, sort_order, is_default, created_at, updated_at`,
    )
    .bind(input.name ?? null, input.emoji ?? null, input.order ?? null, Date.now(), folderId, userId)
    .first<FolderDatabaseRow>();

  if (!folder) {
    throw new RepositoryError("not_found");
  }

  return mapFolder(folder);
}

export async function deleteFolder(db: D1Database, userId: string, folderId: string): Promise<void> {
  const folder = await getFolder(db, userId, folderId);
  if (!folder) {
    throw new RepositoryError("not_found");
  }
  if (folder.isDefault) {
    throw new RepositoryError("default_folder");
  }

  await db.batch([
    db
      .prepare(
        `UPDATE drawings
         SET folder_id = (SELECT id FROM folders WHERE user_id = ? AND is_default = 1),
             updated_at = ?
         WHERE folder_id = ? AND user_id = ?`,
      )
      .bind(userId, Date.now(), folderId, userId),
    db
      .prepare("DELETE FROM folders WHERE id = ? AND user_id = ? AND is_default = 0")
      .bind(folderId, userId),
  ]);
}

function mapFolder(row: FolderDatabaseRow): FolderRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    order: row.sort_order,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
