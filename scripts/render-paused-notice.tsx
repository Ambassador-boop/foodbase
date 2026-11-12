/**
 * Renders the ordering-paused notice to static HTML so it can be measured in a
 * real browser at real widths (scripts/check-widths.sh).
 *
 * Not part of the app build; a verification aid only.
 */
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  OrderingPausedButtonNote,
  OrderingPausedNotice,
} from '../components/storefront/ordering-paused-notice'

const notice = (opensAt: string | null, name?: string) =>
  renderToStaticMarkup(<OrderingPausedNotice restaurantName={name} opensAt={opensAt} />)

const note = (opensAt: string | null) =>
  renderToStaticMarkup(<OrderingPausedButtonNote opensAt={opensAt} />)

console.log(
  JSON.stringify({
    noticeWithTime: notice('Opens today at 10:00 AM', "Mama Nkechi's Kitchen"),
    noticeNoTime: notice(null, "Mama Nkechi's Kitchen"),
    noticeLong: notice('Opens Thursday at 11:30 AM', 'The Place Restaurant and Lounge, Victoria Island'),
    noteWithTime: note('Opens today at 10:00 AM'),
    noteNoTime: note(null),
    disabledButton: renderToStaticMarkup(
      <button
        type="button"
        disabled
        className="w-full h-12 font-semibold flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground opacity-50"
      >
        Ordering paused
      </button>,
    ),
  }),
)
