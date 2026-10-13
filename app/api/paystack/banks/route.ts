import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { bankMapToArray, getBanks } from '@/lib/banks';
export async function GET(request:NextRequest){ try { const token=request.headers.get('authorization')?.replace('Bearer ','')||request.cookies.get('auth_token')?.value; if(!token||!await verifyJWT(token))return NextResponse.json({error:'Unauthorized'},{status:401}); const banks = await getBanks(); return NextResponse.json({banks: bankMapToArray(banks)}); } catch{return NextResponse.json({error:'Failed to fetch banks'},{status:500})} }
