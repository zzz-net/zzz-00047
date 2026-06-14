import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/types'
import { cn } from '@/lib/utils'

export default function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-800',
      )}
    >
      {SEVERITY_LABELS[severity] || severity}
    </span>
  )
}
