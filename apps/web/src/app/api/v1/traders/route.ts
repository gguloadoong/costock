import { NextResponse } from 'next/server';
import { TRADERS } from './_data';

export async function GET() {
  return NextResponse.json({ data: TRADERS });
}
