'use client'

import { type FC } from 'react'
import { X, AlertTriangle, UserPlus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ICPScoreBreakdown } from '@/components/prospects/ICPScoreBreakdown'
import { DiscoveryQuestions } from '@/components/prospects/DiscoveryQuestions'
import { CompetitiveLandscape } from '@/components/prospects/CompetitiveLandscape'
import { BriefingExport } from '@/components/prospects/BriefingExport'
import { formatCurrency, formatDate } from '@/lib/exports'
import { EU_AI_ACT_DEADLINE } from '@/lib/constants'
import { daysUntil } from '@/lib/exports'
import type { Prospect, ICPScore, Capability, Signal, CustomerCategoryDef, ClassifyResult } from '@/types'

// ─── Props ──────────────────────────────────────────────────────────

interface ScopingBriefingProps {
  prospect: Prospect & { icpScore: ICPScore }
  matchedCapabilities: Capability[]
  matchedSignals: Signal[]
  categoryDef: CustomerCategoryDef
  tierRecommendation: ClassifyResult
  onClose: () => void
}

// ─── Persona Framing ────────────────────────────────────────────────

const PERSONA_FRAMING: Record<string, string> = {
  ml_engineer: 'Will evaluate technical credibility. Lead with methodology and benchmarks.',
  cto: 'Cares about ROI and competitive advantage. Lead with business impact numbers.',
  compliance: 'Needs regulatory cover. Lead with Article 13 evidence and audit report format.',
  researcher: 'Values scientific rigor. Lead with published papers and reproducible results.',
  executive: 'Focused on strategic value and risk mitigation. Lead with market position and ROI.',
}

const PERSONA_BADGE_VARIANT: Record<string, 'blue' | 'amber' | 'red' | 'purple' | 'green' | 'gray'> = {
  ml_engineer: 'blue',
  cto: 'amber',
  compliance: 'red',
  researcher: 'purple',
  executive: 'green',
}

// ─── Meeting Goal by Stage ──────────────────────────────────────────

function getMeetingGoal(stage: Prospect['pipeline_stage']): string {
  switch (stage) {
    case 'signal_detected':
      return 'Goal: Qualify the opportunity. Confirm pain points, validate model deployment details, identify the internal champion.'
    case 'outreach_sent':
    case 'response_received':
      return 'Goal: Book a technical deep-dive. Demonstrate interpretability value with a concrete example relevant to their deployment.'
    case 'meeting_booked':
      return 'Goal: Scope the Tier 1 assessment. Agree on model, use cases, timeline, and success criteria. Discuss pricing anchor.'
    case 'discovery_complete':
      return 'Goal: Send proposal. Confirm all scoping details and agree on engagement structure.'
    case 'proposal_sent':
      return 'Goal: Address objections and close. Review proposal terms, clarify deliverables, agree on timeline.'
    case 'verbal_agreement':
      return 'Goal: Finalize contract. Confirm SOW details, payment terms, and kickoff date.'
    case 'contract_signed':
      return 'Goal: Kickoff meeting. Align on first-week deliverables, introduce the research team, set communication cadence.'
    case 'lost':
      return 'Goal: Win-back assessment. Understand what changed, identify new pain points, propose a lower-commitment re-engagement.'
  }
}

// ─── Pain-to-Capability Mapping ─────────────────────────────────────

function findCapabilityForPain(painPoint: string, capabilities: Capability[]): Capability | null {
  const lower = painPoint.toLowerCase()

  // Direct keyword match
  for (const cap of capabilities) {
    const capLower = cap.name.toLowerCase() + ' ' + cap.description.toLowerCase()
    if (lower.includes('hallucination') && capLower.includes('hallucination')) return cap
    if (lower.includes('reasoning') && capLower.includes('reasoning')) return cap
    if (lower.includes('bias') && capLower.includes('bias')) return cap
    if (lower.includes('safety') && capLower.includes('safety')) return cap
    if (lower.includes('cost') && capLower.includes('cost')) return cap
    if (lower.includes('token') && capLower.includes('token')) return cap
    if (lower.includes('compliance') && capLower.includes('compliance')) return cap
    if (lower.includes('interpretab') && capLower.includes('interpretab')) return cap
    if (lower.includes('transparen') && capLower.includes('transparen')) return cap
  }

  // Fallback: return first capability if any exist
  return capabilities.length > 0 ? (capabilities[0] ?? null) : null
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatEngineLabel(engine: string): string {
  return engine.charAt(0).toUpperCase() + engine.slice(1)
}

// ─── Component ──────────────────────────────────────────────────────

export const ScopingBriefing: FC<ScopingBriefingProps> = ({
  prospect,
  matchedCapabilities,
  matchedSignals,
  categoryDef,
  tierRecommendation,
  onClose,
}) => {
  const briefingDate = formatDate(new Date().toISOString(), 'long')
  const euDays = daysUntil(EU_AI_ACT_DEADLINE)

  return (
    <div className="space-y-6">
      {/* ─── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <BriefingExport
          prospect={prospect}
          onCopy={() => undefined}
          onEmail={() => undefined}
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4 mr-1" />
          Close
        </Button>
      </div>

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="border-y border-border-default py-4">
        <p className="text-xs uppercase tracking-[0.15em] text-text-secondary font-medium mb-1">
          Assessment Scoping Briefing
        </p>
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          {prospect.name}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          {briefingDate} &middot; Prepared by Forge for the {categoryDef.name} segment
        </p>
        {euDays > 0 && (
          <p className="text-xs text-accent-amber mt-2">
            {euDays} days until EU AI Act enforcement
          </p>
        )}
      </div>

      {/* ─── Section 1: Company Context ───────────────────────────── */}
      <Card header="Company Context">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-text-secondary">Company</span>
              <span className="text-text-primary font-medium">{prospect.name}</span>

              <span className="text-text-secondary">Industry</span>
              <span className="text-text-primary">{prospect.industry}</span>

              <span className="text-text-secondary">Category</span>
              <div>
                <span className="text-text-primary">{categoryDef.name}</span>
                <p className="text-xs text-text-tertiary mt-0.5">{categoryDef.description}</p>
              </div>

              <span className="text-text-secondary">AI Spend</span>
              <span className="font-mono text-text-primary">{formatCurrency(prospect.estimated_ai_spend)}/mo</span>
            </div>

            {prospect.model_families.length > 0 && (
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-1.5">Model Families</p>
                <div className="flex flex-wrap gap-1.5">
                  {prospect.model_families.map((mf) => (
                    <Badge key={mf} variant="blue" size="sm">{mf}</Badge>
                  ))}
                </div>
              </div>
            )}

            {prospect.regulatory_exposure.length > 0 && (
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-1.5">Regulatory Exposure</p>
                <div className="flex flex-wrap gap-1.5">
                  {prospect.regulatory_exposure.map((reg) => (
                    <Badge key={reg} variant="red" size="sm">{reg}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <ICPScoreBreakdown score={prospect.icpScore} />

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Pipeline Stage</p>
                <p className="text-sm text-text-primary font-medium">{formatStageLabel(prospect.pipeline_stage)}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Pipeline Value</p>
                <p className="font-mono text-sm text-text-primary font-semibold">{formatCurrency(prospect.pipeline_value)}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Revenue Engine</p>
                <p className="text-sm text-text-primary">{formatEngineLabel(prospect.revenue_engine)}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Matched Signals</p>
                <p className="font-mono text-sm text-text-primary">{matchedSignals.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Section 2: People in the Room ────────────────────────── */}
      <Card header="People in the Room">
        {prospect.contacts.length === 0 ? (
          <div className="flex items-start gap-3 p-3 rounded-md bg-accent-amber/10 border border-accent-amber/20">
            <AlertTriangle className="w-4 h-4 text-accent-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-accent-amber font-medium">No contacts identified</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Add contacts to this prospect before the meeting for personalized framing guidance.
              </p>
            </div>
            <UserPlus className="w-4 h-4 text-accent-amber mt-0.5 shrink-0" />
          </div>
        ) : (
          <div className="space-y-3">
            {prospect.contacts.map((contact, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-md bg-base border border-border-subtle">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{contact.name}</span>
                    <Badge variant={PERSONA_BADGE_VARIANT[contact.persona] ?? 'gray'} size="sm">
                      {contact.persona.replace(/_/g, ' ')}
                    </Badge>
                    {contact.is_champion && (
                      <Badge variant="amber" size="sm">Champion</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{contact.title}</p>
                  <p className="text-xs text-text-tertiary mt-1 italic">
                    {PERSONA_FRAMING[contact.persona] ?? 'Prepare context-appropriate talking points.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── Section 3: Pain Diagnosis ────────────────────────────── */}
      {prospect.pain_points.length > 0 && (
        <Card header="Pain Diagnosis">
          <div className="space-y-4">
            {prospect.pain_points.map((pain, idx) => {
              const cap = findCapabilityForPain(pain, matchedCapabilities)
              return (
                <div key={idx} className="p-3 rounded-md bg-base border border-border-subtle">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="red" size="sm">{pain}</Badge>
                    {cap && <Badge variant="green" size="sm">{cap.name}</Badge>}
                  </div>
                  <p className="text-xs text-text-primary leading-relaxed">
                    As a {categoryDef.name.toLowerCase()} deployer in {prospect.industry},{' '}
                    {pain.toLowerCase()} carries significant operational and reputational risk.
                    {cap && (
                      <>
                        {' '}Goodfire&rsquo;s {cap.name} technique
                        {cap.key_results.length > 0 && (
                          <> achieved <span className="font-mono font-semibold text-accent-green">{cap.key_results[0]}</span></>
                        )}
                        {cap.model_families_tested.length > 0 && (
                          <> on {cap.model_families_tested.join(', ')}</>
                        )}
                        {' '}&mdash; directly applicable to this engagement.
                      </>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── Section 4: Discovery Questions ───────────────────────── */}
      <DiscoveryQuestions prospect={prospect} categoryDef={categoryDef} />

      {/* ─── Section 5: Competitive Landscape ─────────────────────── */}
      <CompetitiveLandscape prospect={prospect} />

      {/* ─── Section 6: Pricing Anchor ────────────────────────────── */}
      <Card header="Pricing Anchor">
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Recommended Tier</p>
              <p className="text-sm text-text-primary font-semibold capitalize">{tierRecommendation.tier}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Price Range</p>
              <p className="font-mono text-sm text-text-primary font-semibold">
                {formatCurrency(tierRecommendation.priceRange.low)} &ndash; {formatCurrency(tierRecommendation.priceRange.high)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Duration</p>
              <p className="font-mono text-sm text-text-primary">{tierRecommendation.durationDays} days</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider font-medium mb-0.5">Margin Range</p>
              <p className="font-mono text-sm text-text-primary">
                {tierRecommendation.marginRange.low}% &ndash; {tierRecommendation.marginRange.high}%
              </p>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">{tierRecommendation.rationale}</p>

          <p className="text-xs text-text-tertiary italic">
            This is an initial anchor. Adjust based on discovery conversation findings.
          </p>

          {tierRecommendation.saeCostIfNeeded > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-accent-amber/10 border border-accent-amber/20">
              <AlertTriangle className="w-4 h-4 text-accent-amber mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-accent-amber font-medium">SAE Training Required</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Model family requires SAE training investment of {formatCurrency(tierRecommendation.saeCostIfNeeded)}.
                  {tierRecommendation.breakeven && (
                    <> {tierRecommendation.breakeven.note}</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Section 7: Meeting Goal ──────────────────────────────── */}
      <Card header="Meeting Goal">
        <p className="text-sm text-text-primary leading-relaxed font-medium">
          {getMeetingGoal(prospect.pipeline_stage)}
        </p>
      </Card>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <div className="text-center py-4 border-t border-border-subtle">
        <p className="text-xs text-text-tertiary">
          Briefing generated by Forge &middot; Data as of {briefingDate} &middot; Confidential &mdash; GTM team only
        </p>
      </div>
    </div>
  )
}
