import { getDb } from './db'
import { logEvent } from './event-log'
import { isAPIAvailable, generateCompletion } from './anthropic'
import type { Prospect, Signal, Capability, CustomerCategoryDef, ProspectContact, OutreachRecord } from '@/types'
import type { PipelineStage } from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────

export interface OutreachRequest {
  prospect: Prospect
  signal: Signal
  audience: 'ml_engineer' | 'cto' | 'compliance' | 'researcher' | 'ai_community'
  capabilities: Capability[]
  categoryDef: CustomerCategoryDef
}

export interface GeneratedOutreach {
  subject: string
  body: string
  audience: string
  differentiationLevel: 'surface' | 'mechanism' | 'proof'
  categoryValueProp: string
  signalReference: string
  benchmarks: string[]
  mailtoLink: string
  gmailLink: string
}

// ─── Audience Configuration ────────────────────────────────────────────

interface AudienceConfig {
  salutation: string
  signOff: string
  tone: string
}

const AUDIENCE_CONFIG: Record<string, AudienceConfig> = {
  ml_engineer: {
    salutation: 'Hi',
    signOff: 'Best regards',
    tone: 'technical',
  },
  cto: {
    salutation: 'Hi',
    signOff: 'Best regards',
    tone: 'strategic',
  },
  compliance: {
    salutation: 'Dear Compliance Team',
    signOff: 'Kind regards',
    tone: 'formal',
  },
  researcher: {
    salutation: 'Dear Dr.',
    signOff: 'Best regards',
    tone: 'academic',
  },
  ai_community: {
    salutation: 'Hi',
    signOff: 'Best',
    tone: 'accessible',
  },
}

// ─── CTA by Pipeline Stage ─────────────────────────────────────────────

function selectCTA(stage: PipelineStage): string {
  switch (stage) {
    case 'signal_detected':
      return 'Would a 15-minute call next week make sense to explore this?'
    case 'outreach_sent':
      return 'I sent a note recently about this topic. Wanted to follow up with a specific example that might be relevant.'
    case 'response_received':
      return 'Thanks for your interest. Would it be helpful to schedule a technical deep-dive?'
    case 'meeting_booked':
      return 'Looking forward to our conversation. I prepared a brief analysis that I think you will find useful.'
    case 'discovery_complete':
      return 'Based on our conversation, I have put together a scoping document. Shall we schedule a review?'
    case 'proposal_sent':
      return 'I wanted to check in on the proposal and see if there are any questions I can address.'
    case 'verbal_agreement':
    case 'contract_signed':
      return 'Looking forward to finalizing the details and getting started.'
    case 'lost':
      return 'I understand the timing was not right previously. Circumstances may have changed — would it be worth a brief conversation?'
  }
}

// ─── Contact Matching ──────────────────────────────────────────────────

function findBestContact(prospect: Prospect, audience: string): ProspectContact | null {
  if (prospect.contacts.length === 0) return null
  const personaMap: Record<string, string[]> = {
    ml_engineer: ['ml_engineer', 'researcher'],
    cto: ['cto', 'executive'],
    compliance: ['compliance', 'executive'],
    researcher: ['researcher', 'ml_engineer'],
    ai_community: ['ml_engineer', 'cto'],
  }
  const preferred = personaMap[audience] ?? []
  for (const persona of preferred) {
    const match = prospect.contacts.find((c) => c.persona === persona)
    if (match) return match
  }
  return prospect.contacts[0] ?? null
}

// ─── Link Builders ─────────────────────────────────────────────────────

export function buildMailtoLink(to: string | null, subject: string, body: string): string {
  const recipient = to ?? ''
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function buildGmailLink(to: string | null, subject: string, body: string): string {
  const recipient = to ?? ''
  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ─── Subject Line Generation ───────────────────────────────────────────

function buildSubject(request: OutreachRequest): string {
  const { prospect, signal, audience, capabilities } = request
  const capName = capabilities[0]?.name ?? 'interpretability'
  const painFocus = prospect.pain_points[0] ?? 'AI model transparency'

  switch (audience) {
    case 'ml_engineer':
      return `${capName} for ${painFocus.toLowerCase()}: ${signal.title}`
    case 'cto':
      return `${signal.title} — ROI impact for ${prospect.name}`
    case 'compliance': {
      const regulation = prospect.regulatory_exposure[0] ?? 'AI governance'
      return `${regulation} readiness: interpretability assessment for ${prospect.name}`
    }
    case 'researcher':
      return `Interpretability research: ${capabilities[0]?.paper_title ?? 'SAE-based analysis'} and ${painFocus.toLowerCase()}`
    case 'ai_community':
      return `How interpretability addresses ${signal.title.toLowerCase()}`
  }
}

// ─── Differentiation Block ─────────────────────────────────────────────

function buildDifferentiationBlock(capabilities: Capability[], prospect: Prospect): { surface: string; mechanism: string; proof: string } {
  const modelRef = prospect.model_families[0] ?? 'your models'

  const surface = 'Goodfire provides interpretability infrastructure for enterprise AI: we look inside the model to detect, understand, and fix behaviors before they reach production. Our platform covers hallucination reduction, inference cost optimization, runtime guardrails, and regulatory compliance evidence.'

  const mechanism = `How it works: Sparse Autoencoder (SAE) probes decompose neural network internals into interpretable features. When ${modelRef} hallucinates, we identify the specific internal components responsible — not just flag the output, but diagnose the cause and fix it permanently. These features also serve as confidence detectors for reasoning chain early exit (cutting inference costs) and as real-time classifiers for safety guardrails (sub-millisecond overhead, no separate model needed).`

  const benchmarks = capabilities
    .slice(0, 3)
    .map((c) => {
      const result = c.key_results[0] ?? c.description
      return `- ${c.name} (${c.authors}, ${c.date}): ${result}`
    })
    .join('\n')
  const proof = `These results are peer-reviewed and production-deployed:\n${benchmarks}`

  return { surface, mechanism, proof }
}

// ─── Opening Paragraph ─────────────────────────────────────────────────

function buildOpening(request: OutreachRequest): string {
  const { prospect, signal, audience } = request
  const modelRef = prospect.model_families[0] ?? 'production models'
  const painFocus = prospect.pain_points[0] ?? 'AI model transparency'
  const regulation = prospect.regulatory_exposure[0] ?? null

  switch (audience) {
    case 'ml_engineer':
      return `I noticed ${signal.title.toLowerCase()} — this has direct implications for teams running ${modelRef} in production. At Goodfire, we have built interpretability techniques that address ${painFocus.toLowerCase()} at the feature level, not just at the output layer.`
    case 'cto':
      return `${signal.title} creates both risk and opportunity for AI-forward organizations like ${prospect.name}. Goodfire is the commercial leader in AI interpretability — we turn model transparency into measurable ROI through reduced inference costs, fewer hallucination incidents, and regulatory compliance.`
    case 'compliance':
      return `${signal.title} underscores the growing regulatory expectation for AI transparency and interpretability. For ${prospect.name}${regulation ? `, with exposure to ${regulation}` : ''}, meeting these requirements demands interpretability infrastructure that produces audit-ready evidence.`
    case 'researcher':
      return `${signal.title} opens significant research questions about ${painFocus.toLowerCase()}. Our published work demonstrates that mechanistic interpretability can move beyond analysis to enable genuine scientific discovery — as demonstrated by the novel Alzheimer's biomarker class discovered through model reverse-engineering.`
    case 'ai_community':
      return `${signal.title} highlights why understanding AI model internals matters — not just for safety, but for practical cost reduction and scientific discovery. Goodfire is turning interpretability research into production tools.`
  }
}

// ─── Template-Based Outreach Generation ────────────────────────────────

export function generateOutreach(request: OutreachRequest): GeneratedOutreach {
  const { prospect, signal, audience, capabilities, categoryDef } = request
  const config = AUDIENCE_CONFIG[audience] ?? AUDIENCE_CONFIG['cto'] ?? { salutation: 'Hi', signOff: 'Best regards,\nThe Goodfire Team', tone: 'professional', focus: 'technical' }

  const subject = buildSubject(request)
  const opening = buildOpening(request)
  const diff = buildDifferentiationBlock(capabilities, prospect)
  const cta = selectCTA(prospect.pipeline_stage)

  // Always use proof level for templates (most powerful)
  const differentiationLevel: GeneratedOutreach['differentiationLevel'] = 'proof'
  const diffBlock = diff[differentiationLevel]

  const benchmarks: string[] = capabilities
    .slice(0, 3)
    .map((c) => c.key_results[0])
    .filter((r): r is string => r !== undefined)

  const body = `${config.salutation},

${opening}

${categoryDef.goodfire_value_prop}

${diffBlock}

${cta}

${config.signOff}`

  const contact = findBestContact(prospect, audience)
  const contactEmail = contact?.email ?? null

  return {
    subject,
    body,
    audience,
    differentiationLevel,
    categoryValueProp: categoryDef.goodfire_value_prop,
    signalReference: signal.title,
    benchmarks,
    mailtoLink: buildMailtoLink(contactEmail, subject, body),
    gmailLink: buildGmailLink(contactEmail, subject, body),
  }
}

// ─── AI-Powered Outreach Generation ────────────────────────────────────

export async function generateOutreachWithAPI(request: OutreachRequest): Promise<GeneratedOutreach> {
  if (!isAPIAvailable()) {
    return generateOutreach(request)
  }

  const { prospect, signal, audience, capabilities, categoryDef } = request

  const capSummary = capabilities
    .slice(0, 5)
    .map((c) => `- ${c.name}: ${c.key_results[0] ?? c.description}`)
    .join('\n')

  const systemPrompt = `You are writing outreach for Goodfire, an AI interpretability research company. Write a concise, personalized email. No hype. No buzzwords. Let the evidence speak. The recipient is a ${audience.replace('_', ' ')} at a ${categoryDef.name} company.

Rules:
- Use the 3-level differentiation framework: surface (what we do), mechanism (how it works), proof (published results)
- Include specific benchmarks with citations from the capabilities provided
- Match tone to the audience: ${AUDIENCE_CONFIG[audience]?.tone ?? 'professional'}
- Keep the email under 300 words
- Do NOT use placeholder text or generic filler
- The email should reference the triggering signal naturally
- Return ONLY valid JSON with this exact structure: {"subject": "...", "body": "...", "differentiationLevel": "surface|mechanism|proof", "benchmarks": ["..."]}

Category value proposition to weave in: "${categoryDef.goodfire_value_prop}"

Available capabilities and results:
${capSummary}`

  const userMessage = `Generate a personalized outreach email for ${prospect.name} (${prospect.industry}, ${prospect.customer_category}).

Triggering signal: ${signal.title} — ${signal.description}
Prospect pain points: ${prospect.pain_points.join(', ')}
Regulatory exposure: ${prospect.regulatory_exposure.join(', ') || 'None specified'}
Model families: ${prospect.model_families.join(', ') || 'Not specified'}
Pipeline stage: ${prospect.pipeline_stage}
Audience: ${audience}`

  try {
    const raw = await generateCompletion(systemPrompt, userMessage)

    // Try to parse JSON from the response (handle markdown code blocks)
    let jsonStr = raw
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch?.[1]) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr) as {
      subject?: string
      body?: string
      differentiationLevel?: string
      benchmarks?: string[]
    }

    if (!parsed.subject || !parsed.body) {
      return generateOutreach(request)
    }

    const validLevels = ['surface', 'mechanism', 'proof'] as const
    const diffLevel = validLevels.find((l) => l === parsed.differentiationLevel) ?? 'proof'
    const benchmarks = Array.isArray(parsed.benchmarks) ? parsed.benchmarks.filter((b): b is string => typeof b === 'string') : []

    const contact = findBestContact(prospect, audience)
    const contactEmail = contact?.email ?? null

    return {
      subject: parsed.subject,
      body: parsed.body,
      audience,
      differentiationLevel: diffLevel,
      categoryValueProp: categoryDef.goodfire_value_prop,
      signalReference: signal.title,
      benchmarks,
      mailtoLink: buildMailtoLink(contactEmail, parsed.subject, parsed.body),
      gmailLink: buildGmailLink(contactEmail, parsed.subject, parsed.body),
    }
  } catch {
    return generateOutreach(request)
  }
}

// ─── Burst Outreach Generation ─────────────────────────────────────────

export function generateBurstOutreach(
  prospects: Prospect[],
  signal: Signal,
  audience: 'ml_engineer' | 'cto' | 'compliance' | 'researcher' | 'ai_community',
  capabilities: Capability[],
  categories: CustomerCategoryDef[]
): GeneratedOutreach[] {
  return prospects.map((prospect) => {
    const categoryDef = categories.find((c) => c.id === prospect.customer_category)
    if (!categoryDef) {
      // Fallback: use the first category if no match
      const fallback = categories[0]
      if (!fallback) {
        // Should not happen with seeded data, but handle gracefully
        return generateOutreach({
          prospect,
          signal,
          audience,
          capabilities,
          categoryDef: {
            id: prospect.customer_category,
            name: prospect.customer_category,
            description: '',
            avg_deal_size: { low: 0, high: 0 },
            sales_cycle_days: { low: 0, high: 0 },
            regulatory_tailwinds: [],
            goodfire_value_prop: 'Goodfire provides AI interpretability infrastructure for enterprise AI.',
            priority_rank: 99,
          },
        })
      }
      return generateOutreach({ prospect, signal, audience, capabilities, categoryDef: fallback })
    }
    return generateOutreach({ prospect, signal, audience, capabilities, categoryDef })
  })
}

// ─── Record Outreach ───────────────────────────────────────────────────

export function recordOutreach(
  prospectId: string,
  outreach: GeneratedOutreach,
  signalId: string
): void {
  const db = getDb()

  const row = db.prepare('SELECT outreach_history, pipeline_stage, name FROM prospects WHERE id = ?').get(prospectId) as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(`Prospect not found: ${prospectId}`)
  }

  let existingHistory: OutreachRecord[] = []
  try {
    existingHistory = JSON.parse((row['outreach_history'] as string) ?? '[]') as OutreachRecord[]
  } catch {
    existingHistory = []
  }

  const newRecord: OutreachRecord = {
    date: new Date().toISOString().slice(0, 10),
    type: 'email',
    audience_framing: outreach.audience,
    signal_id: signalId,
    status: 'sent',
    notes: outreach.subject,
  }

  const updatedHistory = [...existingHistory, newRecord]
  const pipelineStage = row['pipeline_stage'] as string
  const prospectName = row['name'] as string

  if (pipelineStage === 'signal_detected') {
    db.prepare(
      'UPDATE prospects SET outreach_history = ?, pipeline_stage = ?, updated_at = datetime(?) WHERE id = ?'
    ).run(
      JSON.stringify(updatedHistory),
      'outreach_sent',
      new Date().toISOString(),
      prospectId
    )

    logEvent({
      eventType: 'pipeline.stage_changed',
      entityType: 'prospect',
      entityId: prospectId,
      payload: {
        prospectName,
        fromStage: 'signal_detected',
        toStage: 'outreach_sent',
      },
    })
  } else {
    db.prepare(
      'UPDATE prospects SET outreach_history = ?, updated_at = datetime(?) WHERE id = ?'
    ).run(
      JSON.stringify(updatedHistory),
      new Date().toISOString(),
      prospectId
    )
  }

  logEvent({
    eventType: 'outreach.sent',
    entityType: 'prospect',
    entityId: prospectId,
    payload: {
      prospectName,
      audience: outreach.audience,
      signalId,
      subject: outreach.subject,
      differentiationLevel: outreach.differentiationLevel,
    },
  })
}
