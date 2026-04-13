'use client'

import { type FC, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { daysUntil } from '@/lib/exports'
import { EU_AI_ACT_DEADLINE } from '@/lib/constants'
import type { Prospect, CustomerCategoryDef } from '@/types'

interface DiscoveryQuestionsProps {
  prospect: Prospect
  categoryDef: CustomerCategoryDef
}

function getFailureCostBenchmarks(category: Prospect['customer_category']): string[] {
  switch (category) {
    case 'data_sovereign_enterprise':
      return [
        'Industry benchmark: $500K\u2013$5M per incident (regulatory investigation, legal fees, reputational damage).',
        'Financial services AI failures trigger SR 11-7 review cycles averaging 6\u201312 months.',
      ]
    case 'ai_native_startup':
      return [
        'Product trust damage: customer churn of 5\u201315% per public AI failure.',
        'Revenue impact: $200K\u2013$2M depending on customer base size.',
      ]
    case 'sovereign_ai_initiative':
      return [
        'Mission-critical failure costs are classified but procurement requirements mandate demonstrated reliability.',
        'Reference DoD AI Ethical Principles and NATO AI strategy requirements.',
      ]
    case 'research_institution':
      return [
        'Retraction costs: $100K\u2013$500K in direct costs, plus multi-year reputational damage.',
        'Grant funding at risk if AI-assisted research cannot demonstrate methodological rigor.',
      ]
    default:
      return [
        'Industry average: $500K\u2013$5M per significant AI model failure.',
        'Includes remediation, review cycles, and trust recovery costs.',
      ]
  }
}

function getMitigationBenchmarks(estimatedAiSpend: number): string[] {
  const monthly = estimatedAiSpend
  const scale = monthly >= 500000 ? 'large' : monthly >= 100000 ? 'medium' : 'small'

  const base: string[] = [
    `At their scale ($${Math.round(monthly / 1000)}K/month inference), typical mitigation spend is:`,
    'Guardrail vendors (Guardrails AI, NeMo, Galileo): $50K\u2013$200K/year',
    'Human review / QA teams: $200K\u2013$500K/year (2\u20135 FTE reviewers)',
    'Fine-tuning cycles: $50K\u2013$200K per cycle, 2\u20134 cycles/year',
    'RLHF annotation: $100K\u2013$300K/year',
  ]

  if (scale === 'large') {
    base.push('Total estimated current spend: $600K\u2013$1.5M/year on model quality measures')
  } else if (scale === 'medium') {
    base.push('Total estimated current spend: $400K\u2013$1.2M/year on model quality measures')
  } else {
    base.push('Total estimated current spend: $200K\u2013$600K/year on model quality measures')
  }

  return base
}

function getBlockedValueBenchmarks(category: Prospect['customer_category']): string[] {
  const euDays = daysUntil(EU_AI_ACT_DEADLINE)
  const isRegulated = category === 'data_sovereign_enterprise' || category === 'sovereign_ai_initiative'

  if (isRegulated) {
    return [
      '$1M\u2013$10M/year in delayed AI deployment due to compliance uncertainty.',
      `${euDays} days until EU AI Act enforcement \u2014 compliance gap represents immediate business risk.`,
      'Each month of delay compounds competitive disadvantage as peers deploy ahead.',
    ]
  }

  if (category === 'ai_native_startup') {
    return [
      '$500K\u2013$5M/year in restricted use cases and conservative deployment decisions.',
      'Each model capability you can\'t trust is a product feature you can\'t ship.',
      `${euDays} days until EU AI Act enforcement \u2014 may affect enterprise customer acquisition.`,
    ]
  }

  return [
    'Industry estimates suggest $1M\u2013$10M/year in value locked behind AI trust gaps.',
    'Delayed deployments, restricted use cases, manual processes that AI could automate.',
    `${euDays} days until EU AI Act enforcement \u2014 cross-border compliance becoming mandatory.`,
  ]
}

interface QuestionDef {
  question: string
  getBenchmarks: (prospect: Prospect) => string[]
}

export const DiscoveryQuestions: FC<DiscoveryQuestionsProps> = ({ prospect, categoryDef }) => {
  const [notes, setNotes] = useState<Record<number, string>>({})

  const questions: QuestionDef[] = [
    {
      question: 'What does a single model failure cost you?',
      getBenchmarks: (p) => getFailureCostBenchmarks(p.customer_category),
    },
    {
      question: 'How much are you spending on current mitigation?',
      getBenchmarks: (p) => getMitigationBenchmarks(p.estimated_ai_spend),
    },
    {
      question: 'What revenue or efficiency is blocked because you can\'t trust the model?',
      getBenchmarks: (p) => getBlockedValueBenchmarks(p.customer_category),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Discovery Questions</h3>
        <span className="text-xs text-text-tertiary">({categoryDef.name} segment)</span>
      </div>

      {questions.map((q, idx) => (
        <Card key={idx}>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-primary">{q.question}</p>

            <div className="space-y-1">
              {q.getBenchmarks(prospect).map((benchmark, bIdx) => (
                <p key={bIdx} className="text-xs text-text-secondary leading-relaxed">{benchmark}</p>
              ))}
            </div>

            <textarea
              value={notes[idx] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [idx]: e.target.value }))}
              placeholder="Notes from conversation..."
              className="w-full h-20 px-3 py-2 text-sm bg-base border border-border-default rounded-md text-text-primary placeholder:text-text-tertiary focus:border-accent-amber focus:ring-1 focus:ring-accent-amber/30 outline-none resize-none transition-colors duration-150"
              maxLength={5000}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}
