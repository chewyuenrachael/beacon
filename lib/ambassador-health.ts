import crypto from 'crypto'
import { getDb, parseJsonArray, toJsonString } from './db'
import { MAX_INPUT_LENGTH } from '@/lib/constants'
import { logEvent } from './event-log'
import type { Engagement, Milestone, Prediction, CreateEngagementInput, UpdateEngagementInput, CreateMilestoneInput, UpdateMilestoneInput } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────

const VALID_ENG_STATUSES = ['active', 'completed', 'proposed', 'paused'] as const
const VALID_MS_STATUSES = ['completed', 'in_progress', 'upcoming', 'blocked'] as const
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidISODate(s: string): boolean {
  return ISO_DATE_RE.test(s) && !isNaN(new Date(s).getTime())
}

// ─── Row Parsers ─────────────────────────────────────────────────────

function parseMilestoneRow(row: Record<string, unknown>): Milestone {
  return {
    id: row['id'] as string,
    engagement_id: row['engagement_id'] as string,
    title: row['title'] as string,
    status: row['status'] as Milestone['status'],
    due_date: row['due_date'] as string,
    completed_date: (row['completed_date'] as string) ?? null,
    notes: (row['notes'] as string) ?? null,
    sort_order: (row['sort_order'] as number) ?? 0,
    created_at: (row['created_at'] as string) ?? new Date().toISOString(),
    updated_at: (row['updated_at'] as string) ?? new Date().toISOString(),
  }
}

function parsePredictionRow(row: Record<string, unknown>): Prediction {
  return {
    id: row['id'] as string,
    engagement_id: row['engagement_id'] as string,
    description: row['description'] as string,
    methodology: row['methodology'] as string,
    severity: row['severity'] as Prediction['severity'],
    confidence: row['confidence'] as Prediction['confidence'],
    outcome: row['outcome'] as Prediction['outcome'],
    outcome_notes: (row['outcome_notes'] as string) ?? null,
    outcome_date: (row['outcome_date'] as string) ?? null,
    model_family_id: (row['model_family_id'] as string) ?? null,
    created_at: (row['created_at'] as string) ?? new Date().toISOString(),
    updated_at: (row['updated_at'] as string) ?? new Date().toISOString(),
  }
}

function parseEngagementRow(row: Record<string, unknown>, milestones: Milestone[], predictions: Prediction[]): Engagement {
  return {
    id: row['id'] as string,
    partner_name: row['partner_name'] as string,
    status: row['status'] as Engagement['status'],
    engagement_tier: (row['engagement_tier'] as Engagement['engagement_tier']) ?? 'standard',
    capabilities_applied: parseJsonArray(row['capabilities_applied'] as string),
    model_family_id: (row['model_family_id'] as string) ?? null,
    start_date: row['start_date'] as string,
    end_date: (row['end_date'] as string) ?? null,
    health_score: row['health_score'] as number,
    pipeline_value: (row['pipeline_value'] as number) ?? 0,
    cost_to_deliver: (row['cost_to_deliver'] as number) ?? 0,
    margin_pct: (row['margin_pct'] as number) ?? 0,
    revenue_engine: (row['revenue_engine'] as Engagement['revenue_engine']) ?? 'direct',
    channel_partner_id: (row['channel_partner_id'] as string) ?? null,
    prospect_id: (row['prospect_id'] as string) ?? null,
    notes: (row['notes'] as string) ?? null,
    milestones,
    predictions,
    created_at: (row['created_at'] as string) ?? new Date().toISOString(),
    updated_at: (row['updated_at'] as string) ?? new Date().toISOString(),
  }
}

function loadMilestonesForEngagement(engagementId: string): Milestone[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM milestones WHERE engagement_id = ? ORDER BY sort_order ASC'
  ).all(engagementId) as Record<string, unknown>[]
  return rows.map(parseMilestoneRow)
}

function loadPredictionsForEngagement(engagementId: string): Prediction[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM predictions WHERE engagement_id = ? ORDER BY created_at ASC'
  ).all(engagementId) as Record<string, unknown>[]
  return rows.map(parsePredictionRow)
}

// ─── READ ─────────────────────────────────────────────────────────────

/**
 * Retrieve all engagements with milestones and predictions.
 * Sorted: active first, then proposed, paused, completed.
 * @returns All engagements
 */
export function getAllEngagements(): Engagement[] {
  const db = getDb()
  const rows = db.prepare(
    `SELECT * FROM engagements ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'proposed' THEN 1 WHEN 'paused' THEN 2 WHEN 'completed' THEN 3 END,
      start_date DESC`
  ).all() as Record<string, unknown>[]
  return rows.map((row) => {
    const id = row['id'] as string
    const milestones = loadMilestonesForEngagement(id)
    const predictions = loadPredictionsForEngagement(id)
    return parseEngagementRow(row, milestones, predictions)
  })
}

/**
 * Retrieve a single engagement by ID with milestones and predictions.
 * @param id - The engagement ID
 * @returns The engagement, or null if not found
 */
export function getEngagementById(id: string): Engagement | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM engagements WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  const milestones = loadMilestonesForEngagement(id)
  const predictions = loadPredictionsForEngagement(id)
  return parseEngagementRow(row, milestones, predictions)
}

/**
 * Retrieve all milestones for a given engagement.
 * @param engagementId - The engagement ID
 * @returns Milestones sorted by sort_order ASC
 */
export function getMilestonesByEngagement(engagementId: string): Milestone[] {
  return loadMilestonesForEngagement(engagementId)
}

/**
 * Aggregate engagement metrics for the Operations dashboard.
 * @returns Object with active count, average health, total pipeline value, total margin
 */
export function getEngagementMetrics(): {
  active: number
  avgHealth: number
  totalValue: number
  totalMargin: number
} {
  const db = getDb()

  const activeRow = db.prepare(
    "SELECT COUNT(*) as count FROM engagements WHERE status = 'active'"
  ).get() as { count: number }

  const healthRow = db.prepare(
    'SELECT AVG(health_score) as avg FROM engagements WHERE status IN (\'active\', \'proposed\')'
  ).get() as { avg: number | null }

  const valueRow = db.prepare(
    'SELECT SUM(pipeline_value) as total FROM engagements'
  ).get() as { total: number | null }

  const marginRow = db.prepare(
    'SELECT SUM(pipeline_value * margin_pct / 100.0) as total FROM engagements WHERE status IN (\'active\', \'completed\')'
  ).get() as { total: number | null }

  return {
    active: activeRow.count,
    avgHealth: Math.round(healthRow.avg ?? 0),
    totalValue: valueRow.total ?? 0,
    totalMargin: Math.round(marginRow.total ?? 0),
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────

/**
 * Create a new engagement with validation.
 * Generates a unique ID and logs the creation event.
 * @param data - The engagement creation input
 * @returns The created engagement
 * @throws Error if validation fails
 */
export function createEngagement(data: CreateEngagementInput): Engagement {
  const name = data.partner_name.trim()
  if (!name || name.length > MAX_INPUT_LENGTH) {
    throw new Error('partner_name must be 1-500 characters')
  }
  if (!VALID_ENG_STATUSES.includes(data.status as typeof VALID_ENG_STATUSES[number])) {
    throw new Error('Invalid engagement status')
  }
  if (!isValidISODate(data.start_date)) {
    throw new Error('start_date must be a valid ISO date (YYYY-MM-DD)')
  }
  if (data.end_date !== undefined && !isValidISODate(data.end_date)) {
    throw new Error('end_date must be a valid ISO date (YYYY-MM-DD)')
  }
  if (data.end_date && data.end_date < data.start_date) {
    throw new Error('end_date must be on or after start_date')
  }

  const db = getDb()
  const id = `eng_${crypto.randomUUID().slice(0, 8)}`
  const capsJson = toJsonString(data.capabilities_applied)

  db.prepare(
    `INSERT INTO engagements (id, partner_name, status, capabilities_applied, start_date, end_date, health_score, notes)
     VALUES (?, ?, ?, ?, ?, ?, 75, ?)`
  ).run(id, name, data.status, capsJson, data.start_date, data.end_date ?? null, data.notes ?? null)

  logEvent({
    eventType: 'engagement.created',
    entityType: 'engagement',
    entityId: id,
    payload: { partnerName: name, status: data.status },
  })

  return getEngagementById(id) as Engagement
}

/**
 * Create a new milestone for an engagement.
 * Sets sort_order to max+1, auto-sets completed_date if status is 'completed'.
 * Recalculates parent engagement health score after creation.
 * @param data - The milestone creation input
 * @returns The created milestone
 * @throws Error if engagement not found or validation fails
 */
export function createMilestone(data: CreateMilestoneInput): Milestone {
  const db = getDb()

  const eng = db.prepare('SELECT id FROM engagements WHERE id = ?').get(data.engagement_id) as { id: string } | undefined
  if (!eng) {
    throw new Error('Engagement not found')
  }

  const title = data.title.trim()
  if (!title || title.length > MAX_INPUT_LENGTH) {
    throw new Error('title must be 1-500 characters')
  }
  if (!VALID_MS_STATUSES.includes(data.status as typeof VALID_MS_STATUSES[number])) {
    throw new Error('Invalid milestone status')
  }
  if (!isValidISODate(data.due_date)) {
    throw new Error('due_date must be a valid ISO date (YYYY-MM-DD)')
  }

  const id = `ms_${crypto.randomUUID().slice(0, 8)}`
  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as max_order FROM milestones WHERE engagement_id = ?'
  ).get(data.engagement_id) as { max_order: number | null }).max_order ?? -1
  const completedDate = data.status === 'completed' ? data.due_date : null

  db.prepare(
    `INSERT INTO milestones (id, engagement_id, title, status, due_date, completed_date, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.engagement_id, title, data.status, data.due_date, completedDate, data.notes ?? null, maxOrder + 1)

  if (data.status === 'completed') {
    logEvent({
      eventType: 'milestone.completed',
      entityType: 'milestone',
      entityId: id,
      payload: { engagementId: data.engagement_id, title },
    })
  }

  updateEngagementHealthScore(data.engagement_id)

  const row = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Record<string, unknown>
  return parseMilestoneRow(row)
}

// ─── UPDATE ───────────────────────────────────────────────────────────

/**
 * Update an existing engagement with partial data.
 * Validates each provided field. Recalculates health on status change.
 * Logs status change events.
 * @param id - The engagement ID
 * @param data - Partial update fields
 * @returns The updated engagement, or null if not found
 * @throws Error if validation fails
 */
export function updateEngagement(id: string, data: UpdateEngagementInput): Engagement | null {
  const db = getDb()

  const existing = db.prepare('SELECT * FROM engagements WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null

  const sets: string[] = []
  const values: unknown[] = []

  if (data.partner_name !== undefined) {
    const name = data.partner_name.trim()
    if (!name || name.length > MAX_INPUT_LENGTH) throw new Error('partner_name must be 1-500 characters')
    sets.push('partner_name = ?')
    values.push(name)
  }
  if (data.status !== undefined) {
    if (!VALID_ENG_STATUSES.includes(data.status as typeof VALID_ENG_STATUSES[number])) throw new Error('Invalid engagement status')
    sets.push('status = ?')
    values.push(data.status)
  }
  if (data.capabilities_applied !== undefined) {
    sets.push('capabilities_applied = ?')
    values.push(toJsonString(data.capabilities_applied))
  }
  if (data.start_date !== undefined) {
    if (!isValidISODate(data.start_date)) throw new Error('start_date must be a valid ISO date')
    sets.push('start_date = ?')
    values.push(data.start_date)
  }
  if (data.end_date !== undefined) {
    if (data.end_date !== null && !isValidISODate(data.end_date)) throw new Error('end_date must be a valid ISO date')
    sets.push('end_date = ?')
    values.push(data.end_date)
  }
  if (data.health_score !== undefined) {
    if (data.health_score < 0 || data.health_score > 100) throw new Error('health_score must be 0-100')
    sets.push('health_score = ?')
    values.push(data.health_score)
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?')
    values.push(data.notes)
  }

  if (sets.length === 0) {
    return getEngagementById(id)
  }

  sets.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE engagements SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  if (data.status !== undefined && data.status !== existing['status']) {
    logEvent({
      eventType: 'engagement.status_changed',
      entityType: 'engagement',
      entityId: id,
      payload: {
        from: existing['status'] as string,
        to: data.status,
        partnerName: existing['partner_name'] as string,
      },
    })
    updateEngagementHealthScore(id)
  }

  return getEngagementById(id)
}

/**
 * Update an existing milestone with partial data.
 * Handles completed_date auto-set/clear on status transitions.
 * Recalculates parent engagement health score.
 * @param id - The milestone ID
 * @param data - Partial update fields
 * @returns The updated milestone, or null if not found
 * @throws Error if validation fails
 */
export function updateMilestone(id: string, data: UpdateMilestoneInput): Milestone | null {
  const db = getDb()

  const existing = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null

  const oldStatus = existing['status'] as string
  const sets: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    const title = data.title.trim()
    if (!title || title.length > MAX_INPUT_LENGTH) throw new Error('title must be 1-500 characters')
    sets.push('title = ?')
    values.push(title)
  }
  if (data.due_date !== undefined) {
    if (!isValidISODate(data.due_date)) throw new Error('due_date must be a valid ISO date')
    sets.push('due_date = ?')
    values.push(data.due_date)
  }
  if (data.sort_order !== undefined) {
    sets.push('sort_order = ?')
    values.push(data.sort_order)
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?')
    values.push(data.notes)
  }

  if (data.status !== undefined) {
    if (!VALID_MS_STATUSES.includes(data.status as typeof VALID_MS_STATUSES[number])) throw new Error('Invalid milestone status')
    sets.push('status = ?')
    values.push(data.status)

    if (data.status === 'completed' && oldStatus !== 'completed') {
      const completedDate = data.completed_date !== undefined ? data.completed_date : new Date().toISOString().slice(0, 10)
      sets.push('completed_date = ?')
      values.push(completedDate)
    } else if (data.status !== 'completed' && oldStatus === 'completed') {
      sets.push('completed_date = ?')
      values.push(null)
    }
  } else if (data.completed_date !== undefined) {
    sets.push('completed_date = ?')
    values.push(data.completed_date)
  }

  if (sets.length === 0) {
    return parseMilestoneRow(existing)
  }

  sets.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE milestones SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const engagementId = existing['engagement_id'] as string

  if (data.status === 'completed' && oldStatus !== 'completed') {
    logEvent({
      eventType: 'milestone.completed',
      entityType: 'milestone',
      entityId: id,
      payload: {
        engagementId,
        title: (data.title ?? existing['title']) as string,
      },
    })
  }

  updateEngagementHealthScore(engagementId)

  const updated = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Record<string, unknown>
  return parseMilestoneRow(updated)
}

// ─── Health Score ─────────────────────────────────────────────────────

/**
 * Recalculate and persist the health score for an engagement based on milestones.
 * Formula: base 70, +5 per completed (max +20), -10 per overdue (max -30),
 * -15 per blocked, +10 bonus if all completed. Clamped to 0-100.
 * @param id - The engagement ID
 * @returns The new health score
 */
export function updateEngagementHealthScore(id: string): number {
  const db = getDb()
  const milestones = db.prepare(
    'SELECT * FROM milestones WHERE engagement_id = ?'
  ).all(id) as Record<string, unknown>[]

  let score = 70
  const today = new Date().toISOString().slice(0, 10)

  let completedCount = 0
  let overdueCount = 0
  let blockedCount = 0

  for (const ms of milestones) {
    const status = ms['status'] as string
    const dueDate = ms['due_date'] as string

    if (status === 'completed') {
      completedCount++
    } else if (status === 'blocked') {
      blockedCount++
    } else if (dueDate < today) {
      overdueCount++
    }
  }

  score += Math.min(completedCount * 5, 20)
  score -= Math.min(overdueCount * 10, 30)
  score -= blockedCount * 15

  if (milestones.length > 0 && completedCount === milestones.length) {
    score += 10
  }

  score = Math.max(0, Math.min(100, score))

  db.prepare('UPDATE engagements SET health_score = ?, updated_at = datetime(?) WHERE id = ?')
    .run(score, 'now', id)

  return score
}

/**
 * Calculate and persist health score for an engagement.
 * Alias for updateEngagementHealthScore. Logs a health_changed event.
 * @param engagementId - The engagement ID
 * @returns The new health score (0-100)
 */
export function calculateHealthScore(engagementId: string): number {
  const db = getDb()
  const before = db.prepare('SELECT health_score FROM engagements WHERE id = ?').get(engagementId) as { health_score: number } | undefined
  const previousScore = before?.health_score ?? 0

  const newScore = updateEngagementHealthScore(engagementId)

  if (newScore !== previousScore) {
    logEvent({
      eventType: 'engagement.health_changed',
      entityType: 'engagement',
      entityId: engagementId,
      payload: { from: previousScore, to: newScore },
    })
  }

  return newScore
}

// ─── DELETE ───────────────────────────────────────────────────────────

/**
 * Delete an engagement and all associated milestones and predictions (cascade).
 * Logs the deletion event before removing the record.
 * @param id - The engagement ID
 * @returns true if deleted, false if not found
 */
export function deleteEngagement(id: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT id, partner_name FROM engagements WHERE id = ?').get(id) as { id: string; partner_name: string } | undefined
  if (!existing) return false

  logEvent({
    eventType: 'engagement.status_changed',
    entityType: 'engagement',
    entityId: id,
    payload: { action: 'deleted', partnerName: existing.partner_name },
  })

  db.prepare('DELETE FROM milestones WHERE engagement_id = ?').run(id)
  db.prepare('DELETE FROM predictions WHERE engagement_id = ?').run(id)
  db.prepare('DELETE FROM engagements WHERE id = ?').run(id)
  return true
}

/**
 * Delete a milestone and recalculate parent engagement health score.
 * @param id - The milestone ID
 * @returns true if deleted, false if not found
 */
export function deleteMilestone(id: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT engagement_id, title FROM milestones WHERE id = ?').get(id) as { engagement_id: string; title: string } | undefined
  if (!existing) return false

  db.prepare('DELETE FROM milestones WHERE id = ?').run(id)
  updateEngagementHealthScore(existing.engagement_id)
  return true
}
