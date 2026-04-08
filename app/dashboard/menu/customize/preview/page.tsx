import { Suspense } from "react"
import PreviewPage from "./PreviewPage"

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading preview...</div>}>
      <PreviewPage />
    </Suspense>
  )
}