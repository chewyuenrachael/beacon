'use client'

import { type FC } from 'react'
import { Users, Zap, CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { PeerCluster, Prospect, ICPScore } from '@/types'

interface PeerClusterViewProps {
  clusters: PeerCluster[]
  prospects: (Prospect & { icpScore: ICPScore })[]
  onSelectProspect: (id: string) => void
  onStartOutreachBurst: (clusterId: string) => void
  onPlanDinner: (clusterId: string) => void
}

type ClusterStatus = 'identified' | 'outreach_active' | 'dinner_planned' | 'converting'

const STATUS_VARIANT: Record<ClusterStatus, 'gray' | 'amber' | 'purple' | 'green'> = {
  identified: 'gray',
  outreach_active: 'amber',
  dinner_planned: 'purple',
  converting: 'green',
}

const STATUS_LABEL: Record<ClusterStatus, string> = {
  identified: 'Identified',
  outreach_active: 'Outreach Active',
  dinner_planned: 'Dinner Planned',
  converting: 'Converting',
}

const MAX_SHOWN = 5

export const PeerClusterView: FC<PeerClusterViewProps> = ({
  clusters,
  prospects,
  onSelectProspect,
  onStartOutreachBurst,
  onPlanDinner,
}) => {
  if (clusters.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users size={32} className="text-text-tertiary mb-3" />
          <p className="text-sm text-text-secondary">No peer clusters identified yet.</p>
          <p className="text-xs text-text-tertiary mt-1">Clusters appear as prospects with shared traits are grouped.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {clusters.map((cluster) => {
        const clusterProspects = prospects.filter((p) => p.peer_cluster_id === cluster.id)
        const shown = clusterProspects.slice(0, MAX_SHOWN)
        const remaining = clusterProspects.length - MAX_SHOWN

        return (
          <Card key={cluster.id}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{cluster.name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="blue" size="sm">{cluster.industry}</Badge>
                  <Badge variant="gray" size="sm">{cluster.region}</Badge>
                  <Badge variant={STATUS_VARIANT[cluster.status as ClusterStatus] ?? 'gray'} size="sm">
                    {STATUS_LABEL[cluster.status as ClusterStatus] ?? cluster.status}
                  </Badge>
                </div>
              </div>
              <span className="text-xs text-text-tertiary font-mono">
                {clusterProspects.length} prospect{clusterProspects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Prospect list */}
            {clusterProspects.length > 0 ? (
              <div className="space-y-1 mb-3">
                {shown.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProspect(p.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm text-left hover:bg-[#F0EDE6] transition-colors duration-150"
                  >
                    <span className="text-xs text-text-primary truncate">{p.name}</span>
                    <span className={`font-mono text-xs font-medium ${
                      p.icpScore.composite >= 70 ? 'text-[#3D6B35]' :
                      p.icpScore.composite >= 40 ? 'text-[#8A6B20]' :
                      'text-[#5C5A50]'
                    }`}>
                      {p.icpScore.composite}
                    </span>
                  </button>
                ))}
                {remaining > 0 && (
                  <p className="text-[10px] text-text-tertiary px-2">+{remaining} more</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary mb-3">No prospects assigned</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onStartOutreachBurst(cluster.id)}
                disabled={clusterProspects.length === 0}
              >
                <Zap size={12} className="mr-1" />
                Outreach Burst
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPlanDinner(cluster.id)}
                disabled={clusterProspects.length === 0}
              >
                <CalendarDays size={12} className="mr-1" />
                Plan Dinner
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
