import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Fetch all key messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('key_messages')
      .select('*')
      .order('created_at');

    if (msgError) throw msgError;
    if (!messages || messages.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all scores
    const { data: scores, error: scoreError } = await supabaseAdmin
      .from('pullthrough_scores')
      .select('mention_id, message_id, score, evidence, scored_at')
      .order('scored_at', { ascending: false });

    if (scoreError) throw scoreError;

    // Count total unique scored mentions
    const allScoredMentions = new Set((scores || []).map(s => s.mention_id));
    const totalScored = allScoredMentions.size;

    // Compute stats per message
    const result = messages.map(msg => {
      const msgScores = (scores || []).filter(s => s.message_id === msg.id);
      const pullThroughCount = msgScores.filter(s => s.score > 0).length;
      const centralCount = msgScores.filter(s => s.score === 2).length;
      const recentEvidence = msgScores
        .filter(s => s.evidence)
        .slice(0, 3)
        .map(s => s.evidence);

      return {
        ...msg,
        scored_mentions: totalScored,
        pull_through_count: pullThroughCount,
        central_count: centralCount,
        pull_through_rate: totalScored > 0 ? pullThroughCount / totalScored : 0,
        recent_evidence: recentEvidence,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/pullthrough/messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, shorthand, category } = body;

    if (!message || !shorthand || !category) {
      return NextResponse.json(
        { error: 'message, shorthand, and category are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('key_messages')
      .insert({ message, shorthand, category })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('POST /api/pullthrough/messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create message' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const allowed = ['message', 'shorthand', 'category', 'is_active'];
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key];
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    filtered.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('key_messages')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('PATCH /api/pullthrough/messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update message' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('key_messages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('DELETE /api/pullthrough/messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deactivate message' },
      { status: 500 }
    );
  }
}
