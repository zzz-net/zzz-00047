import { STATUS_COLORS, STATUS_LABELS, type InspectionStatus } from '@/types'
import { cn } from '@/lib/utils'

export default function StatusBadge({ status }: { status: InspectionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
