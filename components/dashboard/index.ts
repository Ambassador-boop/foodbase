/**
 * Dashboard design system (Batch 3A).
 *
 * Import from '@/components/dashboard' rather than reaching into individual
 * files so a later rename stays a one-line change. See docs/DESIGN_SYSTEM.md.
 */

export {
  DashSurface,
  PageContainer,
  PageHeader,
  SectionCard,
  InsetPanel,
  Stack,
  Row,
  SplitLayout,
  StatGrid,
  Rule,
  KeyValueList,
} from '@/components/dashboard/layout'

export { StatTile, StatBar } from '@/components/dashboard/stat-tile'
export { StatusPill, StatusBadge, Counter } from '@/components/dashboard/status-pill'
export { EmptyState, ErrorState, Notice, Skeleton, PageSkeleton, TableSkeleton } from '@/components/dashboard/empty-state'
export { DataTable, SearchInput, FilterTabs, type Column, type SortState } from '@/components/dashboard/data-table'
export {
  FormField,
  TextField,
  TextArea,
  SelectField,
  PasswordField,
  CheckboxField,
  CheckmarkList,
  TextInput,
  TextAreaField,
  SelectInput,
  PasswordInput,
  type FieldMeta,
} from '@/components/dashboard/form-field'
export { Stepper, ProgressLine } from '@/components/dashboard/stepper'
export { Toggle, TimeInput } from '@/components/dashboard/toggle'
export { ChecklistItem, type ChecklistStatus } from '@/components/dashboard/checklist-item'
export { toast, ToastRegion } from '@/components/dashboard/toast'
export { ConfirmDialog } from '@/components/dashboard/confirm-dialog'
export { MapContainer } from '@/components/dashboard/map-container'
export {
  money,
  count,
  percent,
  dateTime,
  relativeTime,
  formatNigerianPhone,
  statusTone,
  type Tone,
} from '@/components/dashboard/tokens'
