import { AdminShell } from '@/components/admin/shell'
import { EditorialFontScope } from '@/lib/editorial-fonts'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // The admin console uses the dashboard design system, so it loads the
  // editorial pairing here rather than in the root layout.
  return (
    <EditorialFontScope>
      <AdminShell>{children}</AdminShell>
    </EditorialFontScope>
  )
}
