'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/finance'
import { formatNaira } from '@/lib/finance'
import { formatWat } from '@/lib/wat'
import { usePinAuthorization } from '@/hooks/use-pin-authorization'

export default function RefundDetailsPage(){
 const {refundId}=useParams<{refundId:string}>(); const router=useRouter(); const [refund,setRefund]=useState<any>(null); const [error,setError]=useState(''); const {authorize}=usePinAuthorization()
 useEffect(()=>{fetch(`/api/refunds/${refundId}`,{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load refund');setRefund(d)}).catch(e=>setError(e.message))},[refundId])
 if(error)return <main className="mx-auto max-w-[960px] px-4 py-6"><Card className="p-5 text-sm text-danger">{error}</Card></main>
 if(!refund)return <main className="mx-auto max-w-[960px] px-4 py-6"><p className="text-sm text-muted-foreground">Loading refund…</p></main>
 const status=String(refund.status||'pending'); const completed=['processed','completed','refunded','success'].includes(status.toLowerCase()); const failed=['failed','rejected'].includes(status.toLowerCase()); const retry=async()=>{const ticket=await authorize('refund',{orderId:refund.order.id,amount:refund.amount},`Refund ${formatNaira(refund.amount)}`);const r=await fetch(`/api/refunds/${refundId}/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({authorizationTicket:ticket})});const d=await r.json();if(r.ok&&d.refundId)router.push(`/dashboard/finance/refunds/${d.refundId}`)}
 return <main className="mx-auto w-full max-w-[960px] space-y-5 px-4 py-5 md:px-6"><Button variant="ghost" onClick={()=>router.back()}><ArrowLeft className="mr-2 size-4"/>Back</Button><div><p className="text-xs text-muted-foreground">Refund {String(refund.id).slice(0,8)}</p><h1 className="text-2xl font-semibold">Refund</h1></div><Card className="p-5"><div className="flex items-start justify-between gap-4"><div><StatusBadge status={status}/><p className="mt-4 text-[28px] font-semibold num">{formatNaira(refund.amount)}</p><p className="mt-1 text-sm text-muted-foreground">Requested {formatWat(refund.created_at,{dateStyle:'medium',timeStyle:'short'})} WAT</p></div></div><div className="mt-7 space-y-5"><Timeline title="Refund requested" done/><Timeline title="Sent to payment provider" done={completed||status==='processing'}/><Timeline title="Refund processed" done={completed}/></div><dl className="mt-8 space-y-3 border-t border-border pt-5 text-sm"><Detail label="Reason" value={refund.reason}/><Detail label="Notes" value={refund.notes}/><Detail label="Customer email" value={refund.order?.customer_email_masked}/><Detail label="Expected by" value={refund.expected_at?formatWat(refund.expected_at,{dateStyle:'medium',timeStyle:'short'})+' WAT':'—'}/></dl>{failed&&<Button className="mt-6" onClick={retry}>Try again as a new refund</Button>}</Card></main>
}
function Timeline({title,done}:{title:string;done:boolean}){return <div className="flex items-center gap-3"><span className={`size-2 rounded-full ${done?'bg-success':'bg-slate-300'}`}/><span className="text-sm">{title}</span></div>}
function Detail({label,value}:{label:string;value:any}){return <div className="flex justify-between gap-4"><dt className="text-[13px] text-muted-foreground">{label}</dt><dd className="text-right text-sm">{value||'—'}</dd></div>}
