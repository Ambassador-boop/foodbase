'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/finance'
import { formatNaira } from '@/lib/finance'
import { formatWat } from '@/lib/wat'

export default function WithdrawalDetailsPage(){
 const {withdrawalId}=useParams<{withdrawalId:string}>(); const router=useRouter(); const [data,setData]=useState<any>(null); const [error,setError]=useState('')
 useEffect(()=>{fetch(`/api/withdrawals/${withdrawalId}`,{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load withdrawal');setData(d)}).catch(e=>setError(e.message))},[withdrawalId])
 if(error)return <main className="mx-auto max-w-[960px] px-4 py-6"><Card className="p-5 text-sm text-danger">{error}</Card></main>
 if(!data)return <main className="mx-auto max-w-[960px] px-4 py-6"><p className="text-sm text-muted-foreground">Loading withdrawal…</p></main>
 const bank=data.bank_name||data.bank_code||'Bank'; const status=String(data.status||'pending')
 return <main className="mx-auto w-full max-w-[960px] space-y-5 px-4 py-5 md:px-6"><Button variant="ghost" onClick={()=>router.back()}><ArrowLeft className="mr-2 size-4"/>Back</Button><div><p className="text-xs text-muted-foreground">Withdrawal {String(data.id).slice(0,8)}</p><h1 className="text-2xl font-semibold">Withdrawal</h1></div><Card className="p-5"><StatusBadge status={status}/><p className="mt-4 text-[28px] font-semibold num">{formatNaira(data.amount)}</p><dl className="mt-7 space-y-3 border-t border-border pt-5 text-sm"><Detail label="Bank" value={`${bank} •••• ${data.bank_account_number_last4||String(data.bank_account_number||'').slice(-4)}`}/><Detail label="Account holder" value={data.bank_account_holder}/><Detail label="Our reference" value={data.reference}/><Detail label="Fee" value={formatNaira(data.fee??data.withdrawal_fee??0)}/><Detail label="Net amount" value={formatNaira(data.net_amount)}/><Detail label="Requested" value={data.requested_at?formatWat(data.requested_at,{dateStyle:'medium',timeStyle:'short'})+' WAT':'—'}/><Detail label="Processed" value={data.processed_at?formatWat(data.processed_at,{dateStyle:'medium',timeStyle:'short'})+' WAT':'—'}/></dl>{data.failure_reason&&<p className="mt-5 text-sm text-danger">{data.failure_reason}</p>}</Card></main>
}
function Detail({label,value}:{label:string;value:any}){return <div className="flex justify-between gap-4"><dt className="text-[13px] text-muted-foreground">{label}</dt><dd className="text-right text-sm">{value||'—'}</dd></div>}
