import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch all key messages (for shorthand labels)
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('key_messages')
      .select('id, shorthand')
      .eq('is_active', true)
      .order('created_at');

    if (msgError) throw msgError;
    if (!messages || messages.length === 0) {
      return NextResponse.json([]);
    }

    const messageMap = new Map(messages.map(m => [m.id, m.shorthand]));

    // Fetch all scored mentions with their author
    const { data: scores, error: scoreError } = await supabaseAdmin
      .from('pullthrough_scores')
      .select('mention_id, message_id, score');

    if (scoreError) throw scoreError;
    if (!scores || scores.length === 0) {
      return NextResponse.json([]);
    }

    // Get the mention IDs we need authors for
    const mentionIds = [...new Set(scores.map(s => s.mention_id))];
    const { data: mentions, error: mentionError } = await supabaseAdmin
      .from('mentions')
      .select('id, author')
      .in('id', mentionIds);

    if (mentionError) throw mentionError;

    const authorMap = new Map((mentions || []).map(m => [m.id, m.author || 'Unknown']));

    // Group scores by outlet (author)
    const outletData: Record<string, {
      mentionIds: Set<string>;
      messageScores: Record<string, { total: number; pullthrough: number }>;
    }> = {};

    for (const score of scores) {
      const author = authorMap.get(score.mention_id) || 'Unknown';
      if (!outletData[author]) {
        outletData[author] = { mentionIds: new Set(), messageScores: {} };
      }
      outletData[author].mentionIds.add(score.mention_id);

      const msgId = score.message_id;
      if (!outletData[author].messageScores[msgId]) {
        outletData[author].messageScores[msgId] = { total: 0, pullthrough: 0 };
      }
      outletData[author].messageScores[msgId].total++;
      if (score.score > 0) {
        outletData[author].messageScores[msgId].pullthrough++;
      }
    }

    // Build response
    const result = Object.entries(outletData).map(([outlet, data]) => {
      const perMessage = Object.entries(data.messageScores).map(([msgId, counts]) => ({
        shorthand: messageMap.get(msgId) || msgId,
        rate: counts.total > 0 ? counts.pullthrough / counts.total : 0,
        count: counts.pullthrough,
      }));

      const totalScores = Object.values(data.messageScores);
      const totalAll = totalScores.reduce((sum, c) => sum + c.total, 0);
      const totalPullthrough = totalScores.reduce((sum, c) => sum + c.pullthrough, 0);

      return {
        outlet,
        total_scored: data.mentionIds.size,
        messages: perMessage,
        overall_rate: totalAll > 0 ? totalPullthrough / totalAll : 0,
      };
    }).sort((a, b) => b.total_scored - a.total_scored);

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/pullthrough/by-outlet error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch outlet data' },
      { status: 500 }
    );
  }
}
