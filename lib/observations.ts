import crypto from 'crypto'
import { getDb } from './db'
import type { EventLog, EventType } from '@/types'
import type { UserRole } from '@/lib/constants'

// ─── Types ───────────────────────────────────────────────────────────

interface LogEventInput {
  eventType: EventType
  entityType: string
  entityId: string
  actorRole?: UserRole | 'system'
  payload?: Record<string, unknown>
}

// ─── Row Parser ──────────────────────────────────────────────────────

function parseEventRow(row: Record<string, unknown>): EventLog {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row['payload'] as string) as Record<string, unknown>
  } catch {
    payload = {}
  }

  return {
    id: row['id'] as string,
    timestamp: row['timestamp'] as string,
    event_type: row['event_type'] as EventType,
    entity_type: row['entity_type'] as string,
    entity_id: row['entity_id'] as string,
    actor_role: row['actor_role'] as UserRole | 'system',
    payload,
  }
}

// ─── WRITE (append-only) ─────────────────────────────────────────────

/**
 * Append an event to the immutable event log.
 * INSERT only — never update or delete event_log rows.
 * @param event - The event data to log
 */
export function logEvent(event: LogEventInput): void {
  const db = getDb()
  const id = `evt_${crypto.randomUUID().slice(0, 8)}`
  const actorRole = event.actorRole ?? 'system'
  const payloadStr = event.payload ? JSON.stringify(event.payload) : '{}'

  db.prepare(
    `INSERT INTO event_log (id, event_type, entity_type, entity_id, actor_role, payload)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, event.eventType, event.entityType, event.entityId, actorRole, payloadStr)
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Retrieve the most recent events across all types.
 * @param limit - Maximum number of events to return (default 50)
 * @returns Array of EventLog entries, newest first
 */
export function getRecentEvents(limit: number = 50): EventLog[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM event_log ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Record<string, unknown>[]
  return rows.map(parseEventRow)
}

/**
 * Retrieve all events for a specific entity.
 * @param entityType - The type of entity (e.g., 'engagement', 'milestone')
 * @param entityId - The ID of the entity
 * @returns Array of EventLog entries for that entity, newest first
 */
export function getEventsByEntity(entityType: string, entityId: string): EventLog[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM event_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC'
  ).all(entityType, entityId) as Record<string, unknown>[]
  return rows.map(parseEventRow)
}

/**
 * Retrieve events filtered by event type, optionally since a given date.
 * @param eventType - The event type to filter by
 * @param since - Optional ISO date string; only events on or after this timestamp are returned
 * @returns Array of matching EventLog entries, newest first
 */
export function getEventsByType(eventType: EventType, since?: string): EventLog[] {
  const db = getDb()

  if (since) {
    const rows = db.prepare(
      'SELECT * FROM event_log WHERE event_type = ? AND timestamp >= ? ORDER BY timestamp DESC'
    ).all(eventType, since) as Record<string, unknown>[]
    return rows.map(parseEventRow)
  }

  const rows = db.prepare(
    'SELECT * FROM event_log WHERE event_type = ? ORDER BY timestamp DESC'
  ).all(eventType) as Record<string, unknown>[]
  return rows.map(parseEventRow)
}

/**
 * Retrieve recent events formatted for the Operations dashboard activity feed.
 * Parses payload JSON for display.
 * @param limit - Maximum number of events to return (default 25)
 * @returns Array of EventLog entries, newest first
 */
export function getActivityFeed(limit: number = 25): EventLog[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM event_log ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Record<string, unknown>[]
  return rows.map(parseEventRow)
}
