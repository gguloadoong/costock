import { NextResponse } from 'next/server';
import { TRADERS } from '../_data';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const trader = TRADERS.find((t) => t.id === params.id);

  if (!trader) {
    return NextResponse.json({ error: '트레이더를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ data: trader });
}
