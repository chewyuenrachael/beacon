'use client'

import { type FC } from 'react'
import { ChevronUp, ChevronDown, ArrowUpDown, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ICPScoreBreakdown } from '@/components/prospects/ICPScoreBreakdown'
import type { Prospect, ICPScore } from '@/types'

export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface ProspectTableProps {
  prospects: (Prospect & { icpScore: ICPScore })[]
  selectedId: string | null
  onSelect: (id: string) => void
  sortConfig: SortConfig
  onSort: (key: string) => void
}

const CATEGORY_SHORT: Record<string, string> = {
  data_sovereign_enterprise: 'Data Sovereign',
  ai_native_startup: 'AI Native',
  cost_optimizer: 'Cost Opt',
  research_institution: 'Research',
  model_customization_platform: 'Platform',
  sovereign_ai_initiative: 'Sovereign AI',
}

const CATEGORY_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'> = {
  data_sovereign_enterprise: 'blue',
  ai_native_startup: 'purple',
  cost_optimizer: 'amber',
  research_institution: 'green',
  model_customization_platform: 'gray',
  sovereign_ai_initiative: 'red',
}

const STAGE_LABELS: Record<string, string> = {
  signal_detected: 'Signal',
  outreach_sent: 'Outreach',
  response_received: 'Response',
  meeting_booked: 'Meeting',
  discovery_complete: 'Discovery',
  proposal_sent: 'Proposal',
  verbal_agreement: 'Verbal',
  contract_signed: 'Signed',
  lost: 'Lost',
}

const STAGE_VARIANT: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'> = {
  signal_detected: 'gray',
  outreach_sent: 'amber',
  response_received: 'blue',
  meeting_booked: 'green',
  discovery_complete: 'green',
  proposal_sent: 'purple',
  verbal_agreement: 'purple',
  contract_signed: 'green',
  lost: 'red',
}

const ENGINE_LABELS: Record<string, string> = {
  direct: 'Direct',
  channel: 'Channel',
  monitoring: 'Monitor',
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value}`
}

interface ColumnDef {
  key: string
  label: string
  width: string
  align?: 'left' | 'right'
  sortable?: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: 'icpScore', label: 'ICP', width: 'w-[60px]', align: 'right', sortable: true },
  { key: 'name', label: 'Company', width: 'flex-1 min-w-[180px]', sortable: true },
  { key: 'customer_category', label: 'Category', width: 'w-[130px]', sortable: true },
  { key: 'pipeline_stage', label: 'Stage', width: 'w-[100px]', sortable: true },
  { key: 'pipeline_value', label: 'Value', width: 'w-[90px]', align: 'right', sortable: true },
  { key: 'estimated_ai_spend', label: 'AI Spend', width: 'w-[90px]', align: 'right', sortable: true },
  { key: 'revenue_engine', label: 'Engine', width: 'w-[80px]', sortable: true },
]

export const ProspectTable: FC<ProspectTableProps> = ({
  prospects,
  selectedId,
  onSelect,
  sortConfig,
  onSort,
}) => {
  if (prospects.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users size={32} className="text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">No prospects match your filters.</p>
          <p className="text-xs text-text-tertiary mt-1">Adjust filters or add a new prospect.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card noPadding>
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-border-subtle bg-[#F5F3EE]">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`${col.width} px-1.5 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
          >
            {col.sortable ? (
              <button
                onClick={() => onSort(col.key)}
                className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-text-secondary font-medium hover:text-text-primary transition-colors"
              >
                {col.label}
                {sortConfig.key === col.key ? (
                  sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                ) : (
                  <ArrowUpDown size={9} className="text-text-tertiary" />
                )}
              </button>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">{col.label}</span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border-subtle">
        {prospects.map((p) => {
          const isSelected = p.id === selectedId
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center px-3 py-2.5 text-left transition-colors duration-150 ${
                isSelected
                  ? 'bg-[#C45A3C]/[0.04] border-l-2 border-l-[#C45A3C]'
                  : 'hover:bg-[#F5F3EE]/60 border-l-2 border-l-transparent'
              }`}
            >
              {/* ICP Score */}
              <div className="w-[60px] px-1.5 text-right">
                <ICPScoreBreakdown score={p.icpScore} compact />
              </div>

              {/* Company */}
              <div className="flex-1 min-w-[180px] px-1.5">
                <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                <div className="text-[10px] text-text-tertiary truncate">{p.industry}</div>
              </div>

              {/* Category */}
              <div className="w-[130px] px-1.5">
                <Badge variant={CATEGORY_VARIANT[p.customer_category] ?? 'gray'} size="sm">
                  {CATEGORY_SHORT[p.customer_category] ?? p.customer_category}
                </Badge>
              </div>

              {/* Stage */}
              <div className="w-[100px] px-1.5">
                <Badge variant={STAGE_VARIANT[p.pipeline_stage] ?? 'gray'} size="sm">
                  {STAGE_LABELS[p.pipeline_stage] ?? p.pipeline_stage}
                </Badge>
              </div>

              {/* Value */}
              <div className="w-[90px] px-1.5 text-right">
                <span className="font-mono text-xs text-text-primary">{formatCurrency(p.pipeline_value)}</span>
              </div>

              {/* AI Spend */}
              <div className="w-[90px] px-1.5 text-right">
                <span className="font-mono text-xs text-text-secondary">{formatCurrency(p.estimated_ai_spend)}</span>
              </div>

              {/* Engine */}
              <div className="w-[80px] px-1.5">
                <Badge variant="gray" size="sm">{ENGINE_LABELS[p.revenue_engine] ?? p.revenue_engine}</Badge>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
