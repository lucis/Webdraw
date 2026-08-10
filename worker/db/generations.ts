import type { GenerationPurpose, GenerationRunStatus } from "../../shared/contracts/generation";
import { RepositoryError } from "./types";

interface GenerationRunDatabaseRow {
  id: string;
  drawing_id: string | null;
  artifact_id: string | null;
  purpose: GenerationPurpose;
  model: string | null;
  status: GenerationRunStatus;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  elapsed_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface GenerationRun {
  id: string;
  drawingId: string | null;
  artifactId: string | null;
  purpose: GenerationPurpose;
  model: string | null;
  status: GenerationRunStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  elapsedMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface CreateGenerationRunInput {
  drawingId?: string;
  artifactId?: string;
  purpose: GenerationPurpose;
  model?: string;
}

export interface CompleteGenerationRunInput {
  status: Exclude<GenerationRunStatus, "pending">;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  elapsedMs?: number;
  errorCode?: string;
  errorMessage?: string;
}

export async function createGenerationRun(
  db: D1Database,
  userId: string,
  input: CreateGenerationRunInput,
): Promise<GenerationRun> {
  const now = Date.now();
  const run = await db
    .prepare(
      `INSERT INTO generation_runs (
         id, user_id, drawing_id, artifact_id, purpose, model, status, created_at
       )
       SELECT ?, users.id, ?, ?, ?, ?, 'pending', ?
       FROM users
       WHERE users.id = ?
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM drawings WHERE id = ? AND user_id = users.id
         ))
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM artifacts WHERE id = ? AND user_id = users.id
         ))
       RETURNING id, drawing_id, artifact_id, purpose, model, status,
                 prompt_tokens, completion_tokens, total_tokens, elapsed_ms,
                 error_code, error_message, created_at, completed_at`,
    )
    .bind(
      crypto.randomUUID(),
      input.drawingId ?? null,
      input.artifactId ?? null,
      input.purpose,
      input.model ?? null,
      now,
      userId,
      input.drawingId ?? null,
      input.drawingId ?? null,
      input.artifactId ?? null,
      input.artifactId ?? null,
    )
    .first<GenerationRunDatabaseRow>();

  if (!run) {
    throw new RepositoryError("not_found");
  }
  return mapGenerationRun(run);
}

export async function completeGenerationRun(
  db: D1Database,
  userId: string,
  runId: string,
  input: CompleteGenerationRunInput,
): Promise<GenerationRun> {
  const run = await db
    .prepare(
      `UPDATE generation_runs
       SET status = ?, prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, elapsed_ms = ?,
           error_code = ?, error_message = ?, completed_at = ?
       WHERE id = ? AND user_id = ? AND status = 'pending'
       RETURNING id, drawing_id, artifact_id, purpose, model, status,
                 prompt_tokens, completion_tokens, total_tokens, elapsed_ms,
                 error_code, error_message, created_at, completed_at`,
    )
    .bind(
      input.status,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.totalTokens ?? null,
      input.elapsedMs ?? null,
      input.errorCode ?? null,
      input.errorMessage ?? null,
      Date.now(),
      runId,
      userId,
    )
    .first<GenerationRunDatabaseRow>();

  if (!run) {
    throw new RepositoryError("not_found");
  }
  return mapGenerationRun(run);
}

function mapGenerationRun(row: GenerationRunDatabaseRow): GenerationRun {
  return {
    id: row.id,
    drawingId: row.drawing_id,
    artifactId: row.artifact_id,
    purpose: row.purpose,
    model: row.model,
    status: row.status,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    elapsedMs: row.elapsed_ms,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
