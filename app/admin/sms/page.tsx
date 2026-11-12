'use client'

import { PageHeader } from '@/components/admin/ui'
import { SmsPanel } from '@/components/admin/sms-panel'

export default function AdminSmsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="SMS wallet"
        description="The KudiSMS wallet pays for order and delivery messages. Fund it from platform revenue, authorised with your PIN."
        meta={
          <>
            <span>KudiSMS virtual account</span>
            <span aria-hidden="true">·</span>
            <span>All amounts in naira</span>
          </>
        }
      />
      <SmsPanel />
    </div>
  )
}
