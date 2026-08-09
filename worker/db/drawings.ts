import { RepositoryError, type DrawingRow, type DrawingScene } from "./types";

interface DrawingDatabaseRow {
  id: string;
  user_id: string;
  folder_id: string;
  name: string;
  scene_json: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface CreateDrawingInput {
  folderId: string;
  name: string;
  scene: DrawingScene;
}

export async function listDrawings(
  db: D1Database,
  userId: string,
  folderId: string,
): Promise<DrawingRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, folder_id, name, scene_json, version, created_at, updated_at
       FROM drawings WHERE user_id = ? AND folder_id = ? ORDER BY updated_at DESC, id ASC`,
    )
    .bind(userId, folderId)
    .all<DrawingDatabaseRow>();

  return result.results.map(mapDrawing);
}

export async function createDrawing(
  db: D1Database,
  userId: string,
  input: CreateDrawingInput,
): Promise<DrawingRow> {
  const now = Date.now();
  const drawing = await db
    .prepare(
      `INSERT INTO drawings (id, user_id, folder_id, name, scene_json, version, created_at, updated_at)
       SELECT ?, ?, folders.id, ?, ?, 1, ?, ?
       FROM folders WHERE folders.id = ? AND folders.user_id = ?
       RETURNING id, user_id, folder_id, name, scene_json, version, created_at, updated_at`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      input.name,
      JSON.stringify(input.scene),
      now,
      now,
      input.folderId,
      userId,
    )
    .first<DrawingDatabaseRow>();

  if (!drawing) {
    throw new RepositoryError("not_found");
  }

  return mapDrawing(drawing);
}

export async function getDrawing(
  db: D1Database,
  userId: string,
  drawingId: string,
): Promise<DrawingRow | null> {
  const drawing = await db
    .prepare(
      `SELECT id, user_id, folder_id, name, scene_json, version, created_at, updated_at
       FROM drawings WHERE id = ? AND user_id = ?`,
    )
    .bind(drawingId, userId)
    .first<DrawingDatabaseRow>();

  return drawing ? mapDrawing(drawing) : null;
}

export async function updateDrawing(
  db: D1Database,
  userId: string,
  drawingId: string,
  expectedVersion: number,
  scene: DrawingScene,
): Promise<DrawingRow> {
  const drawing = await db
    .prepare(
      `UPDATE drawings
       SET scene_json = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ?
       RETURNING id, user_id, folder_id, name, scene_json, version, created_at, updated_at`,
    )
    .bind(JSON.stringify(scene), Date.now(), drawingId, userId, expectedVersion)
    .first<DrawingDatabaseRow>();

  if (drawing) {
    return mapDrawing(drawing);
  }

  const ownedDrawing = await db
    .prepare("SELECT version FROM drawings WHERE id = ? AND user_id = ?")
    .bind(drawingId, userId)
    .first<{ version: number }>();

  throw new RepositoryError(ownedDrawing ? "version_conflict" : "not_found");
}

export async function deleteDrawing(db: D1Database, userId: string, drawingId: string): Promise<void> {
  const result = await db
    .prepare("DELETE FROM drawings WHERE id = ? AND user_id = ?")
    .bind(drawingId, userId)
    .run();

  if (result.meta.changes === 0) {
    throw new RepositoryError("not_found");
  }
}

function mapDrawing(row: DrawingDatabaseRow): DrawingRow {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    name: row.name,
    scene: JSON.parse(row.scene_json) as DrawingScene,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
