import { getDb, parseJsonArray } from './db'
import { logEvent } from './event-log'
import { PIPELINE_STAGES } from '@/lib/constants'
import type { Prospect, ProspectContact, OutreachRecord } from '@/types'
import type { CustomerCategory, RevenueEngine, PipelineStage } from '@/lib/constants'

// ─── Row Parser ──────────────────────────────────────────────────────

function parseProspectRow(row: Record<string, unknown>): Prospect {
  let contacts: ProspectContact[] = []
  try {
    contacts = JSON.parse(row['contacts'] as string) as ProspectContact[]
  } catch {
    contacts = []
  }

  let outreachHistory: OutreachRecord[] = []
  try {
    outreachHistory = JSON.parse(row['outreach_history'] as string) as OutreachRecord[]
  } catch {
    outreachHistory = []
  }

  return {
    id: row['id'] as string,
    name: row['name'] as string,
    industry: row['industry'] as string,
    customer_category: row['customer_category'] as Prospect['customer_category'],
    estimated_ai_spend: (row['estimated_ai_spend'] as number) ?? 0,
    model_families: parseJsonArray(row['model_families'] as string),
    pain_points: parseJsonArray(row['pain_points'] as string),
    regulatory_exposure: parseJsonArray(row['regulatory_exposure'] as string),
    priority_score: (row['priority_score'] as number) ?? 50,
    revenue_engine: (row['revenue_engine'] as Prospect['revenue_engine']) ?? 'direct',
    pipeline_stage: (row['pipeline_stage'] as Prospect['pipeline_stage']) ?? 'signal_detected',
    pipeline_value: (row['pipeline_value'] as number) ?? 0,
    peer_cluster_id: (row['peer_cluster_id'] as string) ?? null,
    contacts,
    outreach_history: outreachHistory,
    notes: (row['notes'] as string) ?? null,
    created_at: (row['created_at'] as string) ?? new Date().toISOString(),
    updated_at: (row['updated_at'] as string) ?? new Date().toISOString(),
  }
}

// ─── Pipeline Stage Updates ──────────────────────────────────────────

/**
 * Update a prospect's pipeline stage with event logging.
 * @returns The updated prospect, or null if not found
 */
export function updateProspectPipelineStage(id: string, stage: PipelineStage): Prospect | null {
  if (!(PIPELINE_STAGES as readonly string[]).includes(stage)) {
    throw new Error('Invalid pipeline stage')
  }

  const db = getDb()
  const existing = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) return null

  const oldStage = existing['pipeline_stage'] as string

  db.prepare(
    "UPDATE prospects SET pipeline_stage = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(stage, id)

  logEvent({
    eventType: 'pipeline.stage_changed',
    entityType: 'prospect',
    entityId: id,
    payload: {
      from: oldStage,
      to: stage,
      prospectName: existing['name'] as string,
      pipeline_value: existing['pipeline_value'] as number,
    },
  })

  const updated = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return updated ? parseProspectRow(updated) : null
}

// ─── Pipeline Overview ───────────────────────────────────────────────

/**
 * Aggregate pipeline analytics across all prospects.
 * Includes breakdowns by stage, category, model family, and revenue engine.
 */
export function getPipelineOverview(): {
  totalProspects: number
  totalPipelineValue: number
  byStage: { stage: PipelineStage; count: number; totalValue: number }[]
  byCategory: { category: CustomerCategory; count: number; totalValue: number }[]
  byModelFamily: { modelFamilyId: string; count: number; totalValue: number }[]
  byRevenueEngine: { engine: RevenueEngine; count: number; totalValue: number }[]
  avgDealSize: number
  conversionRates: { fromStage: PipelineStage; toStage: PipelineStage; rate: number }[]
} {
  const db = getDb()

  // Totals
  const totalRow = db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(pipeline_value), 0) as total_value FROM prospects'
  ).get() as { count: number; total_value: number }

  // By stage
  const stageRows = db.prepare(
    'SELECT pipeline_stage, COUNT(*) as count, COALESCE(SUM(pipeline_value), 0) as total_value FROM prospects GROUP BY pipeline_stage'
  ).all() as { pipeline_stage: string; count: number; total_value: number }[]

  const stageMap = new Map(stageRows.map((r) => [r.pipeline_stage, r]))
  const byStage = (PIPELINE_STAGES as readonly string[]).map((stage) => {
    const row = stageMap.get(stage)
    return {
      stage: stage as PipelineStage,
      count: row?.count ?? 0,
      totalValue: row?.total_value ?? 0,
    }
  })

  // By category
  const categoryRows = db.prepare(
    'SELECT customer_category, COUNT(*) as count, COALESCE(SUM(pipeline_value), 0) as total_value FROM prospects GROUP BY customer_category'
  ).all() as { customer_category: string; count: number; total_value: number }[]

  const byCategory = categoryRows.map((r) => ({
    category: r.customer_category as CustomerCategory,
    count: r.count,
    totalValue: r.total_value,
  }))

  // By model family (count prospects that reference each model family in their JSON array)
  const allProspects = db.prepare('SELECT model_families, pipeline_value FROM prospects').all() as { model_families: string; pipeline_value: number }[]
  const familyMap = new Map<string, { count: number; totalValue: number }>()

  for (const p of allProspects) {
    const families = parseJsonArray(p.model_families)
    for (const mfId of families) {
      const existing = familyMap.get(mfId)
      if (existing) {
        existing.count++
        existing.totalValue += p.pipeline_value
      } else {
        familyMap.set(mfId, { count: 1, totalValue: p.pipeline_value })
      }
    }
  }

  const byModelFamily = Array.from(familyMap.entries()).map(([mfId, data]) => ({
    modelFamilyId: mfId,
    count: data.count,
    totalValue: data.totalValue,
  }))

  // By revenue engine
  const engineRows = db.prepare(
    'SELECT revenue_engine, COUNT(*) as count, COALESCE(SUM(pipeline_value), 0) as total_value FROM prospects GROUP BY revenue_engine'
  ).all() as { revenue_engine: string; count: number; total_value: number }[]

  const byRevenueEngine = engineRows.map((r) => ({
    engine: r.revenue_engine as RevenueEngine,
    count: r.count,
    totalValue: r.total_value,
  }))

  // Average deal size
  const avgDealSize = totalRow.count > 0 ? Math.round(totalRow.total_value / totalRow.count) : 0

  // Conversion rates from event log
  const conversionRates = calculateConversionRates()

  return {
    totalProspects: totalRow.count,
    totalPipelineValue: totalRow.total_value,
    byStage,
    byCategory,
    byModelFamily,
    byRevenueEngine,
    avgDealSize,
    conversionRates,
  }
}

function calculateConversionRates(): { fromStage: PipelineStage; toStage: PipelineStage; rate: number }[] {
  const db = getDb()
  const events = db.prepare(
    "SELECT payload FROM event_log WHERE event_type = 'pipeline.stage_changed'"
  ).all() as { payload: string }[]

  // Count transitions between consecutive pipeline stages
  const transitionCounts = new Map<string, number>()
  const fromCounts = new Map<string, number>()

  for (const evt of events) {
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(evt.payload) as Record<string, unknown>
    } catch {
      continue
    }
    const from = payload['from'] as string | undefined
    const to = payload['to'] as string | undefined
    if (!from || !to) continue

    const key = `${from}|${to}`
    transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1)
    fromCounts.set(from, (fromCounts.get(from) ?? 0) + 1)
  }

  const rates: { fromStage: PipelineStage; toStage: PipelineStage; rate: number }[] = []

  // Calculate rates for consecutive stage pairs (excluding 'lost')
  const stagesWithoutLost = PIPELINE_STAGES.filter((s) => s !== 'lost')
  for (let i = 0; i < stagesWithoutLost.length - 1; i++) {
    const from = stagesWithoutLost[i]
    const to = stagesWithoutLost[i + 1]
    if (!from || !to) continue
    const key = `${from}|${to}`
    const transitions = transitionCounts.get(key) ?? 0
    const total = fromCounts.get(from) ?? 0
    const rate = total > 0 ? Math.round((transitions / total) * 100 * 10) / 10 : 0

    rates.push({
      fromStage: from as PipelineStage,
      toStage: to as PipelineStage,
      rate,
    })
  }

  return rates
}

// ─── Weekly Pipeline Movement ────────────────────────────────────────

/**
 * Analyze pipeline movement within a date range.
 * Uses event_log to determine which prospects advanced, stalled, were lost, or entered.
 */
export function getWeeklyPipelineMovement(weekStart: string, weekEnd: string): {
  advanced: number
  stalled: number
  lost: number
  newEntries: number
} {
  const db = getDb()

  // Get stage change events in the period
  const events = db.prepare(
    "SELECT entity_id, payload FROM event_log WHERE event_type = 'pipeline.stage_changed' AND timestamp >= ? AND timestamp <= ?"
  ).all(weekStart, weekEnd) as { entity_id: string; payload: string }[]

  let advanced = 0
  let lost = 0
  const movedProspectIds = new Set<string>()

  for (const evt of events) {
    movedProspectIds.add(evt.entity_id)
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(evt.payload) as Record<string, unknown>
    } catch {
      continue
    }
    const from = payload['from'] as string | undefined
    const to = payload['to'] as string | undefined
    if (!from || !to) continue

    if (to === 'lost') {
      lost++
    } else {
      const fromIdx = (PIPELINE_STAGES as readonly string[]).indexOf(from)
      const toIdx = (PIPELINE_STAGES as readonly string[]).indexOf(to)
      if (toIdx > fromIdx) {
        advanced++
      }
    }
  }

  // Stalled: prospects with no stage change in the period
  const totalProspects = (db.prepare(
    'SELECT COUNT(*) as count FROM prospects'
  ).get() as { count: number }).count
  const stalled = Math.max(0, totalProspects - movedProspectIds.size)

  // New entries: prospects created in the period
  const newEntries = (db.prepare(
    'SELECT COUNT(*) as count FROM prospects WHERE created_at >= ? AND created_at <= ?'
  ).get(weekStart, weekEnd) as { count: number }).count

  return { advanced, stalled, lost, newEntries }
}
