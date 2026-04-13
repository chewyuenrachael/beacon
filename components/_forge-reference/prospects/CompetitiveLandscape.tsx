'use client'

import { type FC } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Prospect } from '@/types'

interface CompetitiveLandscapeProps {
  prospect: Prospect
}

export const CompetitiveLandscape: FC<CompetitiveLandscapeProps> = ({ prospect }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
        Competitive Landscape
      </h3>
      <p className="text-xs text-text-secondary">
        Three alternatives {prospect.name} is considering:
      </p>

      <div className="grid grid-cols-1 gap-4">
        {/* Option A: Do Nothing */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Badge variant="gray" size="sm">Option A</Badge>
              <span className="text-sm font-semibold text-text-primary">Do Nothing</span>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Risk</p>
              <p className="text-xs text-text-primary leading-relaxed">
                Model failures continue undetected until they become incidents. No root-cause
                visibility means the same failure mode repeats.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">True Cost</p>
              <p className="text-xs text-text-primary leading-relaxed">
                $500K&ndash;$5M per incident in remediation, review cycles, and trust recovery.
                Regulatory exposure compounds with each undetected failure.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Why They Might Choose This</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Inertia, budget constraints, &ldquo;hasn&rsquo;t happened yet&rdquo; bias. Often the default
                until a visible incident forces action.
              </p>
            </div>
          </div>
        </Card>

        {/* Option B: Guardrails / Output Monitoring */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Badge variant="blue" size="sm">Option B</Badge>
              <span className="text-sm font-semibold text-text-primary">Guardrails / Output Monitoring</span>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">What They Get</p>
              <p className="text-xs text-text-primary leading-relaxed">
                Surface-level checks on inputs and outputs. Content filtering, toxicity detection,
                format validation. Catches obvious failures.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">What They Miss</p>
              <p className="text-xs text-text-primary leading-relaxed">
                Root cause of failures remains unknown. Guardrails don&rsquo;t explain WHY the model
                misbehaves &mdash; they only catch it after the fact.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Key Differentiator</p>
              <p className="text-xs text-accent-amber leading-relaxed font-medium">
                &ldquo;Guardrails tell you it happened. We tell you which 14 internal components
                caused it and can fix them permanently.&rdquo;
              </p>
            </div>
          </div>
        </Card>

        {/* Option C: Goodfire */}
        <Card
          className="border-accent-amber/40"
          header={
            <div className="flex items-center gap-2">
              <Badge variant="amber" size="sm">Option C</Badge>
              <span className="text-sm font-semibold text-text-primary">Goodfire</span>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">What They Get</p>
              <p className="text-xs text-text-primary leading-relaxed">
                Mechanistic understanding of model internals. Specific, fixable diagnoses.
                Measurable outcomes with published methodology.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Proof Points</p>
              <div className="space-y-1">
                <p className="text-xs text-text-primary">
                  <span className="font-mono font-semibold text-accent-green">58%</span> hallucination reduction (RLFR, Prasad et al.)
                </p>
                <p className="text-xs text-text-primary">
                  <span className="font-mono font-semibold text-accent-green">68%</span> token savings (Reasoning Theater, Boppana et al.)
                </p>
                <p className="text-xs text-text-primary">
                  <span className="font-mono font-semibold text-accent-green">Novel biomarker</span> discovery (Prima Mente partnership)
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">The Prediction Pitch</p>
              <p className="text-xs text-accent-amber leading-relaxed font-medium">
                &ldquo;Let us analyze your model for two weeks. We will give you 10 predictions
                about behaviors your eval suite cannot catch. You test them. If we are wrong,
                you have lost $100K. If we are right, you will know something about your model
                that nobody else could have told you.&rdquo;
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
