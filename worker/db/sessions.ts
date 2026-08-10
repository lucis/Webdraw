import type { CredentialRow, SessionUserRow, UserRow } from "./types";

interface UserDatabaseRow {
  id: string;
  openrouter_user_id: string;
  interface_model: string | null;
  drawing_model: string | null;
  created_at: number;
  updated_at: number;
}

interface CredentialDatabaseRow {
  user_id: string;
  encrypted_api_key: string;
  iv: string;
  format_version: number;
  updated_at: number;
}

interface SessionUserDatabaseRow {
  id: string;
  openrouter_user_id: string;
}

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  formatVersion: number;
}

export type ModelPreferencePurpose = "interface" | "drawing";

export async function ensureUser(db: D1Database, openRouterUserId: string): Promise<UserRow> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const user = await db
    .prepare(
      `INSERT INTO users (id, openrouter_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(openrouter_user_id) DO UPDATE SET openrouter_user_id = excluded.openrouter_user_id
       RETURNING id, openrouter_user_id, interface_model, drawing_model, created_at, updated_at`,
    )
    .bind(id, openRouterUserId, now, now)
    .first<UserDatabaseRow>();

  if (!user) {
    throw new Error("Failed to ensure user");
  }

  await db
    .prepare(
      `INSERT INTO folders (id, user_id, name, emoji, sort_order, is_default, created_at, updated_at)
       SELECT ?, ?, 'Meus Desenhos', '🎨', 0, 1, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM folders WHERE user_id = ? AND is_default = 1
       )`,
    )
    .bind(crypto.randomUUID(), user.id, now, now, user.id)
    .run();

  return mapUser(user);
}

export async function saveCredential(
  db: D1Database,
  userId: string,
  credential: EncryptedCredential,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO credentials (user_id, encrypted_api_key, iv, format_version, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         encrypted_api_key = excluded.encrypted_api_key,
         iv = excluded.iv,
         format_version = excluded.format_version,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, credential.ciphertext, credential.iv, credential.formatVersion, Date.now())
    .run();
}

export async function getCredential(db: D1Database, userId: string): Promise<CredentialRow | null> {
  const credential = await db
    .prepare(
      `SELECT user_id, encrypted_api_key, iv, format_version, updated_at
       FROM credentials WHERE user_id = ?`,
    )
    .bind(userId)
    .first<CredentialDatabaseRow>();

  return credential ? mapCredential(credential) : null;
}

/** Stores the server-side default selected by a user for a generation mode. */
export async function saveModelPreference(
  db: D1Database,
  userId: string,
  purpose: ModelPreferencePurpose,
  modelId: string,
): Promise<UserRow | null> {
  const column = purpose === "interface" ? "interface_model" : "drawing_model";
  const user = await db
    .prepare(
      `UPDATE users
       SET ${column} = ?, updated_at = ?
       WHERE id = ?
       RETURNING id, openrouter_user_id, interface_model, drawing_model, created_at, updated_at`,
    )
    .bind(modelId, Date.now(), userId)
    .first<UserDatabaseRow>();

  return user ? mapUser(user) : null;
}

export async function createSession(
  db: D1Database,
  userId: string,
  tokenHash: string,
  expiresAt: number,
  createdAt = Date.now(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_used_at)
       SELECT ?, id, ?, ?, ? FROM users WHERE id = ?`,
    )
    .bind(tokenHash, createdAt, expiresAt, createdAt, userId)
    .run();
}

export async function getSessionUser(
  db: D1Database,
  tokenHash: string,
  now = Date.now(),
): Promise<SessionUserRow | null> {
  const user = await db
    .prepare(
      `SELECT users.id, users.openrouter_user_id
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<SessionUserDatabaseRow>();

  if (!user) {
    return null;
  }

  await db
    .prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ? AND user_id = ?")
    .bind(now, tokenHash, user.id)
    .run();

  return { id: user.id, openRouterUserId: user.openrouter_user_id };
}

export async function deleteSession(db: D1Database, userId: string, tokenHash: string): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE token_hash = ? AND user_id = ?")
    .bind(tokenHash, userId)
    .run();
}

function mapUser(row: UserDatabaseRow): UserRow {
  return {
    id: row.id,
    openRouterUserId: row.openrouter_user_id,
    interfaceModel: row.interface_model,
    drawingModel: row.drawing_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCredential(row: CredentialDatabaseRow): CredentialRow {
  return {
    userId: row.user_id,
    ciphertext: row.encrypted_api_key,
    iv: row.iv,
    formatVersion: row.format_version,
    updatedAt: row.updated_at,
  };
}
