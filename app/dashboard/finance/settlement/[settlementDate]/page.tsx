'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard, SettlementRow, NGN } from '@/components/finance'
import { ShoppingBag, ArrowDownLeft, Undo2, RefreshCw, Info } from 'lucide-react'
import { formatWat } from '@/lib/wat'

export default function SettlementPage(){
  const params=useParams<{settlementDate:string}>(); const settlementDate=decodeURIComponent(params?.settlementDate||'').slice(0,10)
  const [data,setData]=useState<any>(null); const [error,setError]=useState(''); const [status,setStatus]=useState(0)
  useEffect(()=>{ if(!settlementDate)return; fetch(`/api/business/settlements/${settlementDate}`,{credentials:'include'}).then(async r=>{const body=await r.json().catch(()=>({}));setStatus(r.status);if(!r.ok){setError(body?.error||'Unknown error');return}setData(body)}).catch(e=>{setStatus(0);setError(e.message||'Network error')}) },[settlementDate])
  if(error)return <main className="mx-auto max-w-[960px] px-4 py-6"><Card className="p-5"><p className="text-sm text-danger">Could not load settlement (HTTP {status}): {error}</p><Button className="mt-4" onClick={()=>location.reload()}><RefreshCw className="mr-2 size-4"/>Try again</Button></Card></main>
  if(!data)return <main className="mx-auto max-w-[960px] px-4 py-6"><p className="text-sm text-muted-foreground">Loading settlement…</p></main>
  const date=new Date(`${settlementDate}T12:00:00`); const title=formatWat(date,{weekday:'long',day:'numeric',month:'short',year:'numeric'}); const settledAt=data.summary?.settled_at?formatWat(data.summary.settled_at,{hour:'numeric',minute:'2-digit'}):'—'
  return <main className="mx-auto w-full max-w-[960px] space-y-5 px-4 py-5 md:px-6"><div><p className="text-xs text-muted-foreground"><a href="/dashboard/finance" className="hover:underline">Finance</a></p><h1 className="text-2xl font-semibold">Settlement</h1><p className="text-sm text-muted-foreground">{title} · settled {settledAt} WAT</p></div><Card className="p-4"><p className="text-xs text-muted-foreground">Settled to available</p><p className="mt-1 text-3xl font-semibold num">{NGN(data.summary?.settled)}</p></Card><div className="grid grid-cols-3 gap-2"><StatCard label="Orders" value={data.summary?.orders||0} icon={ShoppingBag}/><StatCard label="Gross received" value={NGN(data.summary?.gross)} icon={ArrowDownLeft}/><StatCard label="Refunded" value={NGN(data.summary?.refunded)} icon={Undo2}/></div><Card className="p-4">{(data.settlements||[]).map((row:any)=><SettlementRow key={`${row.transaction_id}-${row.order_id}`} row={row} settlementDate={settlementDate}/>)}</Card><Card className="flex items-start gap-2 p-4 text-[13px] text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0"/>Payments Monday to Thursday settle the next day at 5:00 AM WAT. Payments Friday to Sunday settle on Monday at 5:00 AM WAT.</Card></main>
}
