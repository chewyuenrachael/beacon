import { type FC, type ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface MetricCardTrend {
  direction?: 'up' | 'down' | 'neutral'
  positive?: boolean
  value: string
}

interface MetricCardProps {
  value: string | number
  label: string
  trend?: MetricCardTrend
  icon?: ReactNode
  mono?: boolean
}

function resolveDirection(trend: MetricCardTrend): 'up' | 'down' | 'neutral' {
  if (trend.direction) return trend.direction
  if (trend.positive === true) return 'up'
  if (trend.positive === false) return 'down'
  return 'neutral'
}

export const MetricCard: FC<MetricCardProps> = ({ value, label, trend, icon, mono = false }) => {
  return (
    <Card className="relative">
      {icon && (
        <div className="absolute top-4 right-4 text-text-tertiary">
          {icon}
        </div>
      )}
      <div className={`text-2xl font-semibold text-text-primary tracking-tight ${mono ? 'font-mono' : 'font-display'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-text-tertiary font-medium">
        {label}
      </div>
      {trend && (
        <div className="mt-2">
          <TrendIndicator direction={resolveDirection(trend)} value={trend.value} />
        </div>
      )}
    </Card>
  )
}

interface TrendIndicatorProps {
  direction: 'up' | 'down' | 'neutral'
  value: string
}

const TrendIndicator: FC<TrendIndicatorProps> = ({ direction, value }) => {
  const colorClass = direction === 'up'
    ? 'text-[#3D6B35] bg-[#D4E7D0]'
    : direction === 'down'
      ? 'text-[#8A2020] bg-[#EDCFCF]'
      : 'text-[#5C5A50] bg-[#E8E4D9]'

  const Icon = direction === 'up'
    ? ArrowUpRight
    : direction === 'down'
      ? ArrowDownRight
      : Minus

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-xs font-medium font-mono ${colorClass}`}>
      <Icon size={12} />
      {value}
    </span>
  )
}
