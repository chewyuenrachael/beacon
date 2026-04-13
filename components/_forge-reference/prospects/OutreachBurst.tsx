'use client'

import { type FC, useState, useCallback, useEffect } from 'react'
import { X, Check, ChevronRight, Loader2, Copy, Mail, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { PeerCluster, Prospect, ICPScore, ProspectContact, OutreachRecord } from '@/types'

interface OutreachBurstProps {
  isOpen: boolean
  onClose: () => void
  cluster: PeerCluster
  prospects: (Prospect & { icpScore: ICPScore })[]
  onOutreachSaved: () => void
}

interface OutreachConfig {
  prospectId: string
  selected: boolean
  type: OutreachRecord['type']
  audienceFraming: string
}

interface GeneratedEmail {
  prospectId: string
  prospectName: string
  contactName: string | null
  contactEmail: string | null
  subject: string
  body: string
  saved: boolean
}

const AUDIENCE_OPTIONS = [
  { value: 'ML Engineer', label: 'ML Engineer' },
  { value: 'CTO / VP Eng', label: 'CTO / VP Eng' },
  { value: 'Compliance / Risk', label: 'Compliance / Risk' },
  { value: 'Researcher', label: 'Researcher' },
  { value: 'Executive', label: 'Executive' },
]

function findBestContact(prospect: Prospect, framing: string): ProspectContact | null {
  if (prospect.contacts.length === 0) return null
  const framingLower = framing.toLowerCase()
  const personaMap: Record<string, string[]> = {
    'ml engineer': ['ml_engineer', 'researcher'],
    'cto / vp eng': ['cto', 'executive'],
    'compliance / risk': ['compliance', 'executive'],
    'researcher': ['researcher', 'ml_engineer'],
    'executive': ['executive', 'cto'],
  }
  const preferred = personaMap[framingLower] ?? []
  for (const persona of preferred) {
    const match = prospect.contacts.find((c) => c.persona === persona)
    if (match) return match
  }
  return prospect.contacts[0] ?? null
}

function generateOutreachTemplate(
  prospect: Prospect,
  framing: string,
  cluster: PeerCluster,
): { subject: string; body: string } {
  const painFocus = prospect.pain_points[0] ?? 'AI model transparency'
  const regulation = prospect.regulatory_exposure[0] ?? null
  const clusterContext = cluster.name

  const subjectLines: Record<string, string> = {
    'ML Engineer': `SAE-based ${painFocus.toLowerCase()} detection for ${prospect.name}`,
    'CTO / VP Eng': `How ${clusterContext} peers are approaching ${painFocus.toLowerCase()}`,
    'Compliance / Risk': regulation
      ? `${regulation} readiness: interpretability audit for ${prospect.name}`
      : `Model governance framework for ${prospect.name}`,
    'Researcher': `Sparse autoencoder research collaboration — ${painFocus.toLowerCase()}`,
    'Executive': `AI interpretability ROI for ${prospect.name} — peer cluster insights`,
  }

  const subject = subjectLines[framing] ?? `Goodfire interpretability for ${prospect.name}`

  const greeting = `Hi,`
  const l1 = `We look inside the model — Goodfire's sparse autoencoders decompose neural network internals into interpretable features.`
  const l2Pain: Record<string, string> = {
    'Hallucination': `Our RLFR technique reduced hallucinations by 58% in controlled benchmarks (Prasad et al., Feb 2026).`,
    'Bias': `We detect and measure bias at the feature level, not just at the output layer.`,
    'Safety': `SAE-based safety audits reveal hidden model behaviors before they reach production.`,
    'Compliance': regulation
      ? `With ${regulation} deadlines approaching, we provide the interpretability evidence regulators require.`
      : `We provide the model transparency evidence that regulatory frameworks increasingly require.`,
    'Inference Cost': `Our Reasoning Theater research showed 68% token reduction without accuracy loss (Boppana et al., Mar 2026).`,
    'Scientific Discovery': `Goodfire SAEs have enabled novel protein structure insights via Evo-2 interpretability.`,
    'Model Quality': `Feature-level analysis reveals exactly which components drive quality — and which degrade it.`,
  }
  const l2 = l2Pain[painFocus] ?? l2Pain['Hallucination']
  const l3 = `Companies like those in the ${clusterContext} cluster are already exploring this approach. I'd welcome a conversation about how interpretability fits ${prospect.name}'s roadmap.`

  const body = `${greeting}\n\n${l1}\n\n${l2}\n\n${l3}\n\nBest regards`

  return { subject, body }
}

export const OutreachBurst: FC<OutreachBurstProps> = ({
  isOpen,
  onClose,
  cluster,
  prospects,
  onOutreachSaved,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [configs, setConfigs] = useState<OutreachConfig[]>([])
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setConfigs(prospects.map((p) => ({
        prospectId: p.id,
        selected: true,
        type: 'email' as const,
        audienceFraming: 'CTO / VP Eng',
      })))
      setEmails([])
    }
  }, [isOpen, prospects])

  const selectedCount = configs.filter((c) => c.selected).length

  const toggleAll = useCallback((): void => {
    const allSelected = configs.every((c) => c.selected)
    setConfigs((prev) => prev.map((c) => ({ ...c, selected: !allSelected })))
  }, [configs])

  const generateEmails = useCallback((): void => {
    const generated: GeneratedEmail[] = configs
      .filter((c) => c.selected)
      .map((config) => {
        const prospect = prospects.find((p) => p.id === config.prospectId)
        if (!prospect) return null
        const contact = findBestContact(prospect, config.audienceFraming)
        const template = generateOutreachTemplate(prospect, config.audienceFraming, cluster)
        return {
          prospectId: prospect.id,
          prospectName: prospect.name,
          contactName: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          subject: template.subject,
          body: template.body,
          saved: false,
        }
      })
      .filter((e): e is GeneratedEmail => e !== null)

    setEmails(generated)
    setStep(3)
  }, [configs, prospects, cluster])

  const handleCopy = useCallback(async (email: GeneratedEmail): Promise<void> => {
    const text = `Subject: ${email.subject}\n\n${email.body}`
    await navigator.clipboard.writeText(text)
    setCopiedId(email.prospectId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleSaveAll = useCallback(async (): Promise<void> => {
    setSaving(true)
    try {
      for (const email of emails) {
        if (email.saved) continue
        const prospect = prospects.find((p) => p.id === email.prospectId)
        if (!prospect) continue

        const config = configs.find((c) => c.prospectId === email.prospectId)
        const newRecord: OutreachRecord = {
          date: new Date().toISOString().slice(0, 10),
          type: config?.type ?? 'email',
          audience_framing: config?.audienceFraming ?? 'CTO / VP Eng',
          signal_id: null,
          status: 'sent',
          notes: email.subject,
        }

        const updatedHistory = [...prospect.outreach_history, newRecord]
        const updateBody: Record<string, unknown> = { outreach_history: updatedHistory }

        if (prospect.pipeline_stage === 'signal_detected') {
          updateBody['pipeline_stage'] = 'outreach_sent'
        }

        await fetch(`/api/prospects/${email.prospectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        })
      }

      setEmails((prev) => prev.map((e) => ({ ...e, saved: true })))
      onOutreachSaved()
    } finally {
      setSaving(false)
    }
  }, [emails, prospects, configs, onOutreachSaved])

  if (!isOpen) return null

  const withContacts = emails.filter((e) => e.contactEmail).length
  const withoutContacts = emails.length - withContacts

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-4xl max-h-[85vh] rounded-md border border-border-subtle bg-surface flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-[#C45A3C]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Outreach Burst</h2>
              <p className="text-xs text-text-tertiary">{cluster.name} — {cluster.industry} / {cluster.region}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    s === step ? 'bg-[#C45A3C]' : s < step ? 'bg-[#3D6B35]' : 'bg-[#D0CCC4]'
                  }`}
                />
              ))}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Select Prospects */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text-primary">Select Prospects</h3>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {configs.every((c) => c.selected) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="space-y-1">
                {configs.map((config) => {
                  const prospect = prospects.find((p) => p.id === config.prospectId)
                  if (!prospect) return null
                  const contact = prospect.contacts[0]
                  return (
                    <label
                      key={config.prospectId}
                      className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-[#F0EDE6] transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={config.selected}
                        onChange={() => setConfigs((prev) =>
                          prev.map((c) => c.prospectId === config.prospectId ? { ...c, selected: !c.selected } : c)
                        )}
                        className="rounded border-[#D0CCC4] text-[#C45A3C] focus:ring-[#C45A3C]/30"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-text-primary">{prospect.name}</span>
                        <span className="text-[10px] text-text-tertiary ml-2">
                          {contact ? contact.name : 'No contact'}
                        </span>
                      </div>
                      <span className={`font-mono text-xs font-medium ${
                        prospect.icpScore.composite >= 70 ? 'text-[#3D6B35]' :
                        prospect.icpScore.composite >= 40 ? 'text-[#8A6B20]' :
                        'text-[#5C5A50]'
                      }`}>
                        {prospect.icpScore.composite}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Configure Outreach</h3>
              <div className="space-y-2">
                {configs.filter((c) => c.selected).map((config) => {
                  const prospect = prospects.find((p) => p.id === config.prospectId)
                  if (!prospect) return null
                  return (
                    <Card key={config.prospectId}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-text-primary flex-1">{prospect.name}</span>
                        <select
                          value={config.type}
                          onChange={(e) => setConfigs((prev) =>
                            prev.map((c) => c.prospectId === config.prospectId
                              ? { ...c, type: e.target.value as OutreachRecord['type'] }
                              : c
                            )
                          )}
                          className="h-7 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary appearance-none focus:outline-none focus:border-[#C45A3C]"
                        >
                          <option value="email">Email</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="event">Event</option>
                          <option value="referral">Referral</option>
                        </select>
                        <select
                          value={config.audienceFraming}
                          onChange={(e) => setConfigs((prev) =>
                            prev.map((c) => c.prospectId === config.prospectId
                              ? { ...c, audienceFraming: e.target.value }
                              : c
                            )
                          )}
                          className="h-7 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs text-text-primary appearance-none focus:outline-none focus:border-[#C45A3C]"
                        >
                          {AUDIENCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text-primary">Review Generated Outreach</h3>
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <span className="text-[#3D6B35]">{withContacts} with contacts</span>
                  {withoutContacts > 0 && (
                    <span className="text-[#8A6B20]">{withoutContacts} need contacts</span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {emails.map((email) => (
                  <Card key={email.prospectId}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-text-primary">{email.prospectName}</span>
                        <p className="text-[10px] text-text-tertiary">
                          {email.contactName
                            ? `To: ${email.contactName}${email.contactEmail ? ` <${email.contactEmail}>` : ''}`
                            : <span className="text-[#8A6B20]">No contact — add one</span>
                          }
                        </p>
                      </div>
                      {email.saved && <Badge variant="green" size="sm">Saved</Badge>}
                    </div>
                    <p className="text-xs font-medium text-text-primary mb-1">{email.subject}</p>
                    <p className="text-xs text-text-secondary whitespace-pre-line line-clamp-3">{email.body}</p>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border-subtle">
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(email)}>
                        {copiedId === email.prospectId ? <Check size={12} className="mr-1 text-[#3D6B35]" /> : <Copy size={12} className="mr-1" />}
                        {copiedId === email.prospectId ? 'Copied' : 'Copy'}
                      </Button>
                      {email.contactEmail && (
                        <a
                          href={`mailto:${email.contactEmail}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
                          className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-[#F0EDE6] rounded-md transition-colors"
                        >
                          <Mail size={12} />
                          Gmail
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle shrink-0">
          <div className="text-xs text-text-tertiary">
            {step === 1 && `${selectedCount} of ${configs.length} selected`}
            {step === 2 && `Configuring ${selectedCount} outreach messages`}
            {step === 3 && `${emails.length} emails generated`}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => (s > 1 ? s - 1 : s) as 1 | 2 | 3)}>
                Back
              </Button>
            )}
            {step === 1 && (
              <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={selectedCount === 0}>
                Configure
                <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button variant="primary" size="sm" onClick={generateEmails}>
                Generate Outreach
                <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAll}
                disabled={saving || emails.every((e) => e.saved)}
              >
                {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                {emails.every((e) => e.saved) ? 'All Saved' : 'Mark All as Sent'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
