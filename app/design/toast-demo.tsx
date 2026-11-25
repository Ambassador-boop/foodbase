'use client'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/**
 * The one interactive piece of the showcase that needs state of its own.
 * Kept in its own file so /design stays a server component and the page itself
 * ships no JavaScript for the specimens.
 */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast.success('Order 1042 accepted')}
      >
        Success toast
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast.error('Payout could not be sent', {
            description: 'The bank declined the transfer. Try again in a minute.',
          })
        }
      >
        Error toast
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast.warning('Stock is low on Jollof rice')}
      >
        Warning toast
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast('Settlement runs at 6 pm today')}
      >
        Neutral toast
      </Button>
    </div>
  )
}
