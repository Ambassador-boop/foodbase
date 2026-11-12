import { EditorialFontScope } from '@/lib/editorial-fonts'

/**
 * The registration page is built on the dashboard design system, so it loads the
 * editorial pairing here instead of in the root layout. Signs in through the
 * normal auth cookie; nothing else about this route changes.
 */
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <EditorialFontScope>{children}</EditorialFontScope>
}
