import type {
  Artifact,
  ArtifactRecord,
  ArtifactVersion,
  ArtifactVersionMetadata,
} from "../../shared/contracts/artifacts";
import { RepositoryError } from "./types";

interface ArtifactDatabaseRow {
  id: string;
  drawing_id: string;
  kind: Artifact["kind"];
  active_version: number;
  created_at: number;
  updated_at: number;
}

interface ArtifactVersionDatabaseRow {
  artifact_id: string;
  version: number;
  payload_json: string;
  prompt: string | null;
  model: string | null;
  source_snapshot_json: string | null;
  created_at: number;
}

export async function createArtifact(
  db: D1Database,
  userId: string,
  drawingId: string,
  artifact: Artifact,
  metadata: ArtifactVersionMetadata,
): Promise<ArtifactRecord> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO artifacts (id, user_id, drawing_id, kind, active_version, created_at, updated_at)
         SELECT ?, drawings.user_id, drawings.id, ?, 1, ?, ?
         FROM drawings
         WHERE drawings.id = ? AND drawings.user_id = ?`,
      )
      .bind(id, artifact.kind, now, now, drawingId, userId),
    db
      .prepare(
        `INSERT INTO artifact_versions (
           artifact_id, version, kind, payload_json, prompt, model, source_snapshot_json, created_at
         )
         SELECT id, 1, kind, ?, ?, ?, ?, ?
         FROM artifacts
         WHERE id = ? AND user_id = ?`,
      )
      .bind(
        JSON.stringify(artifact),
        metadata.prompt,
        metadata.model,
        serializeSnapshot(metadata.sourceSnapshot),
        now,
        id,
        userId,
      ),
  ]);

  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
    throw new RepositoryError("not_found");
  }

  return {
    id,
    drawingId,
    kind: artifact.kind,
    activeVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createCandidateVersion(
  db: D1Database,
  userId: string,
  artifactId: string,
  artifact: Artifact,
  metadata: ArtifactVersionMetadata,
): Promise<ArtifactVersion> {
  const now = Date.now();
  const version = await db
    .prepare(
      `INSERT INTO artifact_versions (
         artifact_id, version, kind, payload_json, prompt, model, source_snapshot_json, created_at
       )
       SELECT
         artifacts.id,
         COALESCE((
           SELECT MAX(version) FROM artifact_versions WHERE artifact_id = artifacts.id
         ), 0) + 1,
         artifacts.kind,
         ?, ?, ?, ?, ?
       FROM artifacts
       WHERE artifacts.id = ? AND artifacts.user_id = ? AND artifacts.kind = ?
       RETURNING artifact_id, version, payload_json, prompt, model, source_snapshot_json, created_at`,
    )
    .bind(
      JSON.stringify(artifact),
      metadata.prompt,
      metadata.model,
      serializeSnapshot(metadata.sourceSnapshot),
      now,
      artifactId,
      userId,
      artifact.kind,
    )
    .first<ArtifactVersionDatabaseRow>();

  if (!version) {
    throw new RepositoryError("not_found");
  }

  return mapArtifactVersion(version);
}

export async function activateArtifactVersion(
  db: D1Database,
  userId: string,
  artifactId: string,
  expectedActiveVersion: number,
  nextActiveVersion: number,
): Promise<ArtifactRecord> {
  const result = await db
    .prepare(
      `UPDATE artifacts
       SET active_version = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND active_version = ?
         AND EXISTS (
           SELECT 1 FROM artifact_versions
           WHERE artifact_id = artifacts.id AND version = ?
         )`,
    )
    .bind(nextActiveVersion, Date.now(), artifactId, userId, expectedActiveVersion, nextActiveVersion)
    .run();

  if (result.meta.changes === 1) {
    const artifact = await getArtifact(db, userId, artifactId);
    if (artifact) {
      return artifact;
    }
  }

  const owned = await db
    .prepare("SELECT active_version FROM artifacts WHERE id = ? AND user_id = ?")
    .bind(artifactId, userId)
    .first<{ active_version: number }>();

  if (!owned) {
    throw new RepositoryError("not_found");
  }
  if (owned.active_version !== expectedActiveVersion) {
    throw new RepositoryError("version_conflict");
  }

  throw new RepositoryError("not_found");
}

export async function getArtifact(
  db: D1Database,
  userId: string,
  artifactId: string,
): Promise<ArtifactRecord | null> {
  const artifact = await db
    .prepare(
      `SELECT id, drawing_id, kind, active_version, created_at, updated_at
       FROM artifacts WHERE id = ? AND user_id = ?`,
    )
    .bind(artifactId, userId)
    .first<ArtifactDatabaseRow>();

  return artifact ? mapArtifact(artifact) : null;
}

export async function listArtifactVersions(
  db: D1Database,
  userId: string,
  artifactId: string,
): Promise<ArtifactVersion[]> {
  const result = await db
    .prepare(
      `SELECT artifact_versions.artifact_id, artifact_versions.version, artifact_versions.payload_json,
              artifact_versions.prompt, artifact_versions.model, artifact_versions.source_snapshot_json,
              artifact_versions.created_at
       FROM artifact_versions
       JOIN artifacts ON artifacts.id = artifact_versions.artifact_id
       WHERE artifact_versions.artifact_id = ? AND artifacts.user_id = ?
       ORDER BY artifact_versions.version ASC`,
    )
    .bind(artifactId, userId)
    .all<ArtifactVersionDatabaseRow>();

  return result.results.map(mapArtifactVersion);
}

function mapArtifact(row: ArtifactDatabaseRow): ArtifactRecord {
  return {
    id: row.id,
    drawingId: row.drawing_id,
    kind: row.kind,
    activeVersion: row.active_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArtifactVersion(row: ArtifactVersionDatabaseRow): ArtifactVersion {
  return {
    artifactId: row.artifact_id,
    version: row.version,
    artifact: JSON.parse(row.payload_json) as Artifact,
    metadata: {
      prompt: row.prompt,
      model: row.model,
      sourceSnapshot: row.source_snapshot_json === null ? null : JSON.parse(row.source_snapshot_json),
    },
    createdAt: row.created_at,
  };
}

function serializeSnapshot(sourceSnapshot: unknown | null): string | null {
  return sourceSnapshot === null ? null : JSON.stringify(sourceSnapshot);
}
