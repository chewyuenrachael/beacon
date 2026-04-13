'use client'

import { type FC, type ChangeEvent, useState, useCallback } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Loader2, Trash2, Plus, Save, FileText, ArrowLeft, Wrench as ScopeIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ICPScoreBreakdown } from '@/components/prospects/ICPScoreBreakdown'
import { ScopingBriefing } from '@/components/prospects/ScopingBriefing'
import { PIPELINE_STAGES, MAX_TEXTAREA_LENGTH } from '@/lib/constants'
import type { Prospect, ICPScore, ProspectContact, OutreachRecord, ModelFamily, Capability, Signal, CustomerCategoryDef, ClassifyResult } from '@/types'

interface ProspectDetailProps {
  prospect: Prospect & { icpScore: ICPScore }
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  modelFamilies: ModelFamily[]
}

const STAGE_LABELS: Record<string, string> = {
  signal_detected: 'Signal Detected',
  outreach_sent: 'Outreach Sent',
  response_received: 'Response Received',
  meeting_booked: 'Meeting Booked',
  discovery_complete: 'Discovery Complete',
  proposal_sent: 'Proposal Sent',
  verbal_agreement: 'Verbal Agreement',
  contract_signed: 'Contract Signed',
  lost: 'Lost',
}

const PERSONA_LABELS: Record<string, string> = {
  ml_engineer: 'ML Engineer',
  cto: 'CTO',
  compliance: 'Compliance',
  researcher: 'Researcher',
  executive: 'Executive',
}

const PERSONA_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'> = {
  ml_engineer: 'blue',
  cto: 'purple',
  compliance: 'red',
  researcher: 'green',
  executive: 'amber',
}

const OUTREACH_TYPE_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'> = {
  email: 'blue',
  linkedin: 'purple',
  event: 'green',
  referral: 'amber',
}

const STATUS_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'> = {
  sent: 'gray',
  opened: 'blue',
  replied: 'green',
  meeting_booked: 'green',
  no_response: 'red',
}

const PERSONA_OPTIONS = [
  { value: 'ml_engineer', label: 'ML Engineer' },
  { value: 'cto', label: 'CTO' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'executive', label: 'Executive' },
]

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value}`
}

export const ProspectDetail: FC<ProspectDetailProps> = ({
  prospect,
  onUpdate,
  onDelete,
  onClose,
  modelFamilies,
}) => {
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState(prospect.notes ?? '')
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState<ProspectContact>({
    name: '', title: '', email: null, linkedin_url: null, persona: 'ml_engineer', is_champion: false,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Briefing state
  const [showBriefing, setShowBriefing] = useState(false)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingData, setBriefingData] = useState<{
    matchedCapabilities: Capability[]
    matchedSignals: Signal[]
    categoryDef: CustomerCategoryDef
    tierRecommendation: ClassifyResult
  } | null>(null)
  const [briefingError, setBriefingError] = useState<string | null>(null)

  const handlePrepareBriefing = useCallback(async (): Promise<void> => {
    setBriefingLoading(true)
    setBriefingError(null)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: prospect.id }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      const json = await res.json() as {
        data: {
          matchedCapabilities: Capability[]
          matchedSignals: Signal[]
          categoryDef: CustomerCategoryDef
          tierRecommendation: ClassifyResult
        }
      }
      setBriefingData(json.data)
      setShowBriefing(true)
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Failed to generate briefing')
    } finally {
      setBriefingLoading(false)
    }
  }, [prospect.id])

  const handleStageChange = useCallback(async (e: ChangeEvent<HTMLSelectElement>): Promise<void> => {
    setSaving(true)
    try {
      await onUpdate(prospect.id, { pipeline_stage: e.target.value })
    } finally {
      setSaving(false)
    }
  }, [prospect.id, onUpdate])

  const handleNotesBlur = useCallback(async (): Promise<void> => {
    if (notes !== (prospect.notes ?? '')) {
      await onUpdate(prospect.id, { notes: notes || null })
    }
  }, [prospect.id, prospect.notes, notes, onUpdate])

  const handleAddContact = useCallback(async (): Promise<void> => {
    if (!newContact.name.trim()) return
    const updatedContacts: ProspectContact[] = [
      ...prospect.contacts,
      { ...newContact, name: newContact.name.trim(), title: newContact.title.trim() },
    ]
    setSaving(true)
    try {
      await onUpdate(prospect.id, { contacts: updatedContacts })
      setNewContact({ name: '', title: '', email: null, linkedin_url: null, persona: 'ml_engineer', is_champion: false })
      setShowAddContact(false)
    } finally {
      setSaving(false)
    }
  }, [prospect.id, prospect.contacts, newContact, onUpdate])

  const handleDeleteProspect = useCallback(async (): Promise<void> => {
    setSaving(true)
    try {
      await onDelete(prospect.id)
    } finally {
      setSaving(false)
    }
  }, [prospect.id, onDelete])

  const modelFamilyMap = new Map(modelFamilies.map((m) => [m.id, m]))

  if (showBriefing && briefingData) {
    return (
      <div className="fixed inset-y-0 right-0 z-40 w-[600px] bg-surface border-l border-border-subtle shadow-lg overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface border-b border-border-subtle px-5 py-3">
          <button
            onClick={() => setShowBriefing(false)}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Prospect
          </button>
        </div>
        <div className="px-5 py-4">
          <ScopingBriefing
            prospect={prospect}
            matchedCapabilities={briefingData.matchedCapabilities}
            matchedSignals={briefingData.matchedSignals}
            categoryDef={briefingData.categoryDef}
            tierRecommendation={briefingData.tierRecommendation}
            onClose={() => setShowBriefing(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[600px] bg-surface border-l border-border-subtle shadow-lg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border-subtle px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary">{prospect.name}</h2>
            <p className="text-xs text-text-tertiary mt-0.5">{prospect.industry}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-tertiary hover:text-text-primary hover:bg-[#F0EDE6] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 py-3 border-b border-border-subtle flex gap-2">
        <button
          onClick={() => void handlePrepareBriefing()}
          disabled={briefingLoading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-[#D0CCC4] px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#F0EDE6] transition-colors disabled:opacity-50"
        >
          {briefingLoading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {briefingLoading ? 'Generating...' : 'Prepare Briefing'}
        </button>
        <Link
          href={`/solutions?prospect=${prospect.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1A1A1A] px-3 py-2 text-xs font-medium text-white hover:bg-[#333330] transition-colors"
        >
          <ScopeIcon size={12} />
          Scope Engagement
        </Link>
      </div>
      {briefingError && (
        <div className="mx-5 mt-2 rounded-md border border-[#8A2020]/30 bg-[#EDCFCF]/50 px-3 py-2">
          <p className="text-xs text-[#8A2020]">{briefingError}</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-5">
        {/* ICP Score */}
        <Card>
          <ICPScoreBreakdown score={prospect.icpScore} />
        </Card>

        {/* Pipeline */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Pipeline</h3>
          <div className="flex items-center gap-3">
            <Select
              value={prospect.pipeline_stage}
              onChange={handleStageChange}
              options={PIPELINE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] ?? s }))}
              className="flex-1"
            />
            <div className="text-right">
              <span className="font-mono text-sm font-semibold text-text-primary">{formatCurrency(prospect.pipeline_value)}</span>
              <p className="text-[10px] text-text-tertiary">Pipeline Value</p>
            </div>
          </div>
        </section>

        {/* Details */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Details</h3>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">AI Spend</span>
              <p className="font-mono text-sm text-text-primary">{formatCurrency(prospect.estimated_ai_spend)}/mo</p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Model Families</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {prospect.model_families.length > 0 ? prospect.model_families.map((mfId) => {
                  const mf = modelFamilyMap.get(mfId)
                  const tierVariant = mf?.tier === 'tier_a' ? 'green' as const : mf?.tier === 'tier_b' ? 'amber' as const : 'red' as const
                  return (
                    <Badge key={mfId} variant={tierVariant} size="sm">
                      {mf?.name ?? mfId}
                    </Badge>
                  )
                }) : <span className="text-xs text-text-tertiary">None</span>}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Pain Points</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {prospect.pain_points.length > 0 ? prospect.pain_points.map((pp) => (
                  <Badge key={pp} variant="amber" size="sm">{pp}</Badge>
                )) : <span className="text-xs text-text-tertiary">None</span>}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Regulatory Exposure</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {prospect.regulatory_exposure.length > 0 ? prospect.regulatory_exposure.map((reg) => (
                  <Badge key={reg} variant="red" size="sm">{reg}</Badge>
                )) : <span className="text-xs text-text-tertiary">None</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Contacts */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-medium">Contacts</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddContact((v) => !v)}>
              <Plus size={12} className="mr-1" />
              Add
            </Button>
          </div>
          {prospect.contacts.length > 0 ? (
            <div className="space-y-2">
              {prospect.contacts.map((contact, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-sm bg-[#F5F3EE]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-text-primary">{contact.name}</span>
                      {contact.is_champion && <Badge variant="amber" size="sm">Champion</Badge>}
                    </div>
                    <p className="text-[10px] text-text-tertiary">{contact.title}</p>
                    {contact.email && (
                      <p className="text-[10px] text-text-secondary truncate">{contact.email}</p>
                    )}
                  </div>
                  <Badge variant={PERSONA_VARIANT[contact.persona] ?? 'gray'} size="sm">
                    {PERSONA_LABELS[contact.persona] ?? contact.persona}
                  </Badge>
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-tertiary hover:text-[#3A5A80] transition-colors"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No contacts yet</p>
          )}

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="mt-2 p-2 rounded-sm border border-border-subtle space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newContact.name}
                  onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Name"
                  className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary focus:outline-none focus:border-[#C45A3C]"
                />
                <input
                  value={newContact.title}
                  onChange={(e) => setNewContact((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary focus:outline-none focus:border-[#C45A3C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newContact.email ?? ''}
                  onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value || null }))}
                  placeholder="Email"
                  type="email"
                  className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary focus:outline-none focus:border-[#C45A3C]"
                />
                <select
                  value={newContact.persona}
                  onChange={(e) => setNewContact((p) => ({ ...p, persona: e.target.value as ProspectContact['persona'] }))}
                  className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary appearance-none focus:outline-none focus:border-[#C45A3C]"
                >
                  {PERSONA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleAddContact} disabled={!newContact.name.trim() || saving}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Outreach History */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Outreach History</h3>
          {prospect.outreach_history.length > 0 ? (
            <div className="space-y-2">
              {[...prospect.outreach_history].reverse().map((record: OutreachRecord, i: number) => (
                <div key={i} className="p-2 rounded-sm bg-[#F5F3EE]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono text-text-tertiary">{record.date}</span>
                    <Badge variant={OUTREACH_TYPE_VARIANT[record.type] ?? 'gray'} size="sm">{record.type}</Badge>
                    <Badge variant={STATUS_VARIANT[record.status] ?? 'gray'} size="sm">{record.status}</Badge>
                  </div>
                  {record.audience_framing && (
                    <p className="text-[10px] text-text-secondary">Framing: {record.audience_framing}</p>
                  )}
                  {record.notes && (
                    <p className="text-[10px] text-text-tertiary mt-0.5">{record.notes}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No outreach recorded</p>
          )}
        </section>

        {/* Notes */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            maxLength={MAX_TEXTAREA_LENGTH}
            rows={3}
            placeholder="Add notes..."
            className="w-full rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20 resize-none"
          />
        </section>

        {/* Delete */}
        <section className="pt-3 border-t border-border-subtle">
          {!confirmDelete ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-[#8A2020]">
              <Trash2 size={12} className="mr-1" />
              Delete Prospect
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A2020]">Confirm delete?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleDeleteProspect} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
