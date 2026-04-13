import { NextResponse } from 'next/server';
import { scorePressmentions } from '@/lib/pullthrough';
import { scorePressMentions } from '@/lib/pull-through';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await scorePressmentions();
    const narrativeResult = await scorePressMentions();
    return NextResponse.json({
      legacy: result,
      narratives: narrativeResult,
    });
  } catch (error) {
    console.error('POST /api/pullthrough/score error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}
