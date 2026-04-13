'use client'

import { type FC, type ChangeEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CUSTOMER_CATEGORIES, PIPELINE_STAGES, REVENUE_ENGINES } from '@/lib/constants'

export interface ProspectFilterState {
  search: string
  customerCategory: string
  pipelineStage: string
  revenueEngine: string
  minIcpScore: number
}

export const DEFAULT_FILTERS: ProspectFilterState = {
  search: '',
  customerCategory: '',
  pipelineStage: '',
  revenueEngine: '',
  minIcpScore: 0,
}

interface ProspectFiltersProps {
  filters: ProspectFilterState
  onFilterChange: (filters: ProspectFilterState) => void
  resultCount: number
}

const CATEGORY_LABELS: Record<string, string> = {
  data_sovereign_enterprise: 'Data Sovereign',
  ai_native_startup: 'AI Native',
  cost_optimizer: 'Cost Optimizer',
  research_institution: 'Research',
  model_customization_platform: 'Platform',
  sovereign_ai_initiative: 'Sovereign AI',
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
  direct: 'Direct',
  channel: 'Channel',
  monitoring: 'Monitor',
}

function hasActiveFilters(filters: ProspectFilterState): boolean {
  return filters.search !== '' ||
    filters.customerCategory !== '' ||
    filters.pipelineStage !== '' ||
    filters.revenueEngine !== '' ||
    filters.minIcpScore > 0
}

export const ProspectFilters: FC<ProspectFiltersProps> = ({ filters, onFilterChange, resultCount }) => {
  const update = (partial: Partial<ProspectFilterState>): void => {
    onFilterChange({ ...filters, ...partial })
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={filters.search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update({ search: e.target.value })}
          placeholder="Search prospects..."
          maxLength={200}
          className="h-8 w-48 rounded-md border border-[#D0CCC4] bg-white pl-8 pr-3 text-xs text-text-primary placeholder:text-text-tertiary transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
        />
      </div>

      {/* Category */}
      <select
        value={filters.customerCategory}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ customerCategory: e.target.value })}
        className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 pr-7 text-xs text-text-primary appearance-none transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
      >
        <option value="">All Categories</option>
        {CUSTOMER_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
        ))}
      </select>

      {/* Pipeline Stage */}
      <select
        value={filters.pipelineStage}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ pipelineStage: e.target.value })}
        className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 pr-7 text-xs text-text-primary appearance-none transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
      >
        <option value="">All Stages</option>
        {PIPELINE_STAGES.map((stage) => (
          <option key={stage} value={stage}>{STAGE_LABELS[stage] ?? stage}</option>
        ))}
      </select>

      {/* Revenue Engine */}
      <select
        value={filters.revenueEngine}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ revenueEngine: e.target.value })}
        className="h-8 rounded-md border border-[#D0CCC4] bg-white px-2 pr-7 text-xs text-text-primary appearance-none transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
      >
        <option value="">All Engines</option>
        {REVENUE_ENGINES.map((eng) => (
          <option key={eng} value={eng}>{ENGINE_LABELS[eng] ?? eng}</option>
        ))}
      </select>

      {/* Min ICP */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Min ICP</span>
        <input
          type="number"
          min={0}
          max={100}
          value={filters.minIcpScore || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update({ minIcpScore: parseInt(e.target.value, 10) || 0 })}
          placeholder="0"
          className="h-8 w-14 rounded-md border border-[#D0CCC4] bg-white px-2 text-xs font-mono text-text-primary text-center transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
        />
      </div>

      {/* Result count */}
      <span className="text-xs text-text-tertiary ml-auto">
        {resultCount} prospect{resultCount !== 1 ? 's' : ''}
      </span>

      {/* Clear */}
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={() => onFilterChange(DEFAULT_FILTERS)}>
          <X size={12} className="mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
