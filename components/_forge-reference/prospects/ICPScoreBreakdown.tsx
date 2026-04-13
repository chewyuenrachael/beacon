'use client'

import { type FC } from 'react'
import type { ICPScore } from '@/types'

interface ICPScoreBreakdownProps {
  score: ICPScore
  compact?: boolean
}

const factors = [
  { key: 'modelFamilyMatch' as const, label: 'Model Family Match', weight: 0.40, color: 'bg-[#3A5A80]' },
  { key: 'regulatoryPressure' as const, label: 'Regulatory Pressure', weight: 0.25, color: 'bg-[#8A2020]' },
  { key: 'peerClusterDensity' as const, label: 'Peer Cluster Density', weight: 0.20, color: 'bg-[#5A3D80]' },
  { key: 'recentIncidentOrCommitment' as const, label: 'Recent Signals', weight: 0.15, color: 'bg-[#8A6B20]' },
]

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-[#D4E7D0] text-[#3D6B35]'
  if (score >= 40) return 'bg-[#EDE0C8] text-[#8A6B20]'
  return 'bg-[#E8E4D9] text-[#5C5A50]'
}

export const ICPScoreBreakdown: FC<ICPScoreBreakdownProps> = ({ score, compact = false }) => {
  if (compact) {
    return (
      <span className={`inline-flex items-center justify-center w-10 h-7 rounded-sm font-mono text-sm font-semibold ${scoreColor(score.composite)}`}>
        {score.composite}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-text-primary">{score.composite}</span>
        <span className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Composite Score</span>
      </div>

      <div className="space-y-2">
        {factors.map((factor) => {
          const value = score[factor.key]
          return (
            <div key={factor.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-text-secondary">{factor.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-tertiary">{(factor.weight * 100).toFixed(0)}%</span>
                  <span className="font-mono text-xs text-text-primary">{value}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#E8E4D9]">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${factor.color}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-text-tertiary leading-relaxed">{score.breakdown}</p>
    </div>
  )
}
