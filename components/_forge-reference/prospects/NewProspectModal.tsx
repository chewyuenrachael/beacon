'use client'

import { type FC, type ChangeEvent, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CUSTOMER_CATEGORIES, PIPELINE_STAGES, REVENUE_ENGINES, MAX_INPUT_LENGTH, MAX_TEXTAREA_LENGTH } from '@/lib/constants'
import type { ModelFamily, PeerCluster, ProspectContact } from '@/types'

interface NewProspectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateProspectFormData) => Promise<void>
  modelFamilies: ModelFamily[]
  clusters: PeerCluster[]
}

export interface CreateProspectFormData {
  name: string
  industry: string
  customer_category: string
  estimated_ai_spend: number
  model_families: string[]
  pain_points: string[]
  regulatory_exposure: string[]
  revenue_engine: string
  pipeline_stage: string
  pipeline_value: number
  peer_cluster_id: string | null
  contacts: ProspectContact[]
  notes: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  data_sovereign_enterprise: 'Data Sovereign Enterprise',
  ai_native_startup: 'AI Native Startup',
  cost_optimizer: 'Cost Optimizer',
  research_institution: 'Research Institution',
  model_customization_platform: 'Model Customization Platform',
  sovereign_ai_initiative: 'Sovereign AI Initiative',
}

const CATEGORY_VALUE_PROPS: Record<string, string> = {
  data_sovereign_enterprise: 'Know exactly what your AI models do before regulators ask.',
  ai_native_startup: 'Ship interpretable AI as a competitive advantage.',
  cost_optimizer: 'Cut inference costs by understanding which model components matter.',
  research_institution: 'Advance the science of understanding neural networks.',
  model_customization_platform: 'Offer interpretability as a platform feature to your customers.',
  sovereign_ai_initiative: 'Build national AI capabilities with full transparency.',
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

const ENGINE_LABELS: Record<string, string> = {
  direct: 'Direct Sales',
  channel: 'Channel Partner',
  monitoring: 'Monitoring / SaaS',
}

const PAIN_POINT_OPTIONS = [
  'Hallucination', 'Bias', 'Safety', 'Compliance',
  'Inference Cost', 'Scientific Discovery', 'Model Quality',
]

const REGULATORY_OPTIONS = [
  'EU AI Act', 'SR 11-7', 'FDA', 'DORA', 'EIOPA',
]

const PERSONA_OPTIONS = [
  { value: 'ml_engineer', label: 'ML Engineer' },
  { value: 'cto', label: 'CTO' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'executive', label: 'Executive' },
]

const EMPTY_CONTACT: ProspectContact = {
  name: '', title: '', email: null, linkedin_url: null, persona: 'ml_engineer', is_champion: false,
}

function initialFormState(): CreateProspectFormData {
  return {
    name: '',
    industry: '',
    customer_category: 'data_sovereign_enterprise',
    estimated_ai_spend: 0,
    model_families: [],
    pain_points: [],
    regulatory_exposure: [],
    revenue_engine: 'direct',
    pipeline_stage: 'signal_detected',
    pipeline_value: 0,
    peer_cluster_id: null,
    contacts: [],
    notes: null,
  }
}

export const NewProspectModal: FC<NewProspectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  modelFamilies,
  clusters,
}) => {
  const [form, setForm] = useState<CreateProspectFormData>(initialFormState)
  const [contact, setContact] = useState<ProspectContact>({ ...EMPTY_CONTACT })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback((): void => {
    setForm(initialFormState())
    setContact({ ...EMPTY_CONTACT })
    setError(null)
    onClose()
  }, [onClose])

  const toggleArrayItem = (field: 'model_families' | 'pain_points' | 'regulatory_exposure', item: string): void => {
    setForm((prev) => {
      const arr = prev[field]
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      }
    })
  }

  const addContact = (): void => {
    if (!contact.name.trim()) return
    setForm((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { ...contact, name: contact.name.trim(), title: contact.title.trim() }],
    }))
    setContact({ ...EMPTY_CONTACT })
  }

  const removeContact = (index: number): void => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError('Company name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prospect')
    } finally {
      setSaving(false)
    }
  }

  const tierA = modelFamilies.filter((m) => m.tier === 'tier_a')
  const tierB = modelFamilies.filter((m) => m.tier === 'tier_b')
  const tierC = modelFamilies.filter((m) => m.tier === 'tier_c')

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Prospect" size="lg">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Section: Company */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Company</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              maxLength={MAX_INPUT_LENGTH}
              placeholder="Company name"
            />
            <Input
              label="Industry"
              value={form.industry}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, industry: e.target.value }))}
              placeholder="e.g. Financial Services"
            />
          </div>
          <div className="mt-3">
            <Select
              label="Customer Category"
              value={form.customer_category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, customer_category: e.target.value }))}
              options={CUSTOMER_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))}
            />
            {form.customer_category && CATEGORY_VALUE_PROPS[form.customer_category] && (
              <p className="mt-1.5 text-xs text-text-tertiary italic">
                {CATEGORY_VALUE_PROPS[form.customer_category]}
              </p>
            )}
          </div>
        </section>

        {/* Section: Financial */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Financial</h4>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Est. AI Spend ($)"
              value={form.estimated_ai_spend ? String(form.estimated_ai_spend) : ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, estimated_ai_spend: parseInt(e.target.value, 10) || 0 }))}
              type="number"
              placeholder="0"
            />
            <Input
              label="Pipeline Value ($)"
              value={form.pipeline_value ? String(form.pipeline_value) : ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, pipeline_value: parseInt(e.target.value, 10) || 0 }))}
              type="number"
              placeholder="0"
            />
            <Select
              label="Revenue Engine"
              value={form.revenue_engine}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, revenue_engine: e.target.value }))}
              options={REVENUE_ENGINES.map((r) => ({ value: r, label: ENGINE_LABELS[r] ?? r }))}
            />
          </div>
        </section>

        {/* Section: Model Families */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Model Families</h4>
          {[
            { label: 'Tier A — SAEs Available', items: tierA },
            { label: 'Tier B — Planned', items: tierB },
            { label: 'Tier C — On Demand', items: tierC },
          ].map((tier) => (
            tier.items.length > 0 && (
              <div key={tier.label} className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">{tier.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tier.items.map((mf) => {
                    const selected = form.model_families.includes(mf.id)
                    return (
                      <button
                        key={mf.id}
                        type="button"
                        onClick={() => toggleArrayItem('model_families', mf.id)}
                        className={`px-2 py-1 text-xs rounded-sm border transition-colors duration-150 ${
                          selected
                            ? 'border-[#C45A3C] bg-[#C45A3C]/10 text-[#C45A3C] font-medium'
                            : 'border-[#D0CCC4] text-text-secondary hover:border-[#C45A3C]/40'
                        }`}
                      >
                        {mf.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          ))}
        </section>

        {/* Section: Pain Points */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Pain Points</h4>
          <div className="flex flex-wrap gap-1.5">
            {PAIN_POINT_OPTIONS.map((pp) => {
              const selected = form.pain_points.includes(pp)
              return (
                <button
                  key={pp}
                  type="button"
                  onClick={() => toggleArrayItem('pain_points', pp)}
                  className={`px-2 py-1 text-xs rounded-sm border transition-colors duration-150 ${
                    selected
                      ? 'border-[#C45A3C] bg-[#C45A3C]/10 text-[#C45A3C] font-medium'
                      : 'border-[#D0CCC4] text-text-secondary hover:border-[#C45A3C]/40'
                  }`}
                >
                  {pp}
                </button>
              )
            })}
          </div>
        </section>

        {/* Section: Regulatory Exposure */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Regulatory Exposure</h4>
          <div className="flex flex-wrap gap-1.5">
            {REGULATORY_OPTIONS.map((reg) => {
              const selected = form.regulatory_exposure.includes(reg)
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => toggleArrayItem('regulatory_exposure', reg)}
                  className={`px-2 py-1 text-xs rounded-sm border transition-colors duration-150 ${
                    selected
                      ? 'border-[#C45A3C] bg-[#C45A3C]/10 text-[#C45A3C] font-medium'
                      : 'border-[#D0CCC4] text-text-secondary hover:border-[#C45A3C]/40'
                  }`}
                >
                  {reg}
                </button>
              )
            })}
          </div>
        </section>

        {/* Section: Pipeline */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Pipeline</h4>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Pipeline Stage"
              value={form.pipeline_stage}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, pipeline_stage: e.target.value }))}
              options={PIPELINE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] ?? s }))}
            />
            <Select
              label="Peer Cluster"
              value={form.peer_cluster_id ?? ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((p) => ({
                ...p,
                peer_cluster_id: e.target.value || null,
              }))}
              options={[
                { value: '', label: 'None' },
                ...clusters.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
        </section>

        {/* Section: Initial Contact */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Contacts</h4>
          {form.contacts.length > 0 && (
            <div className="space-y-1 mb-2">
              {form.contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[#F0EDE6] rounded-sm">
                  <span className="text-xs text-text-primary flex-1">{c.name} — {c.title}</span>
                  <Badge variant="gray" size="sm">{c.persona}</Badge>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="text-text-tertiary hover:text-[#8A2020] transition-colors text-xs"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <Input
              placeholder="Name"
              value={contact.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContact((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="Title"
              value={contact.title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContact((p) => ({ ...p, title: e.target.value }))}
            />
            <Input
              placeholder="Email"
              value={contact.email ?? ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setContact((p) => ({ ...p, email: e.target.value || null }))}
              type="email"
            />
            <div className="flex gap-1">
              <select
                value={contact.persona}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setContact((p) => ({ ...p, persona: e.target.value as ProspectContact['persona'] }))}
                className="h-9 flex-1 rounded-md border border-[#D0CCC4] bg-white px-1.5 text-xs text-text-primary appearance-none focus:outline-none focus:border-[#C45A3C]"
              >
                {PERSONA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={addContact} disabled={!contact.name.trim()}>
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Section: Notes */}
        <section>
          <h4 className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Notes</h4>
          <textarea
            value={form.notes ?? ''}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setForm((p) => ({ ...p, notes: e.target.value || null }))}
            maxLength={MAX_TEXTAREA_LENGTH}
            rows={3}
            placeholder="Optional notes..."
            className="w-full rounded-md border border-[#D0CCC4] bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20 resize-none"
          />
        </section>
      </div>

      {/* Footer */}
      {error && <p className="text-xs text-[#8A2020] mt-3">{error}</p>}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border-subtle">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
          {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
          Create Prospect
        </Button>
      </div>
    </Modal>
  )
}
