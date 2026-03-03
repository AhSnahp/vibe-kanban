import { cn } from '@cc/lib/cn';
import type { WorkflowPhase } from '@cc/stores/workflow-store';

interface PhaseTimelineProps {
  phases: WorkflowPhase[];
  onPhaseClick?: (phaseId: string) => void;
  activePhaseId?: string;
}

const statusColors: Record<WorkflowPhase['status'], string> = {
  pending: 'bg-gray-400',
  running: 'bg-brand',
  sanity_check: 'bg-yellow-400',
  approved: 'bg-blue-400',
  complete: 'bg-success',
};

const statusBorderColors: Record<WorkflowPhase['status'], string> = {
  pending: 'border-gray-400/30',
  running: 'border-brand/30',
  sanity_check: 'border-yellow-400/30',
  approved: 'border-blue-400/30',
  complete: 'border-success/30',
};

/**
 * Horizontal stepper showing workflow phases with status-colored dots.
 */
export function PhaseTimeline({
  phases,
  onPhaseClick,
  activePhaseId,
}: PhaseTimelineProps) {
  return (
    <div className="flex items-center gap-half overflow-x-auto py-half">
      {phases.map((phase, i) => (
        <div key={phase.id} className="flex items-center shrink-0">
          <button
            onClick={() => onPhaseClick?.(phase.id)}
            className={cn(
              'flex items-center gap-half px-base py-half rounded-sm border text-xs transition-colors',
              activePhaseId === phase.id
                ? 'border-brand bg-brand/10 text-high'
                : statusBorderColors[phase.status] +
                    ' bg-secondary text-normal hover:text-high'
            )}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                statusColors[phase.status],
                phase.status === 'running' && 'animate-pulse'
              )}
            />
            <span className="font-medium">{phase.name}</span>
            <span className="text-low">
              ({phase.tasks.length} task{phase.tasks.length !== 1 ? 's' : ''})
            </span>
          </button>
          {i < phases.length - 1 && (
            <div className="w-4 h-px bg-border mx-half shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
