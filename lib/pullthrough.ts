import { supabaseAdmin } from '@/lib/supabase';
import type { KeyMessageRow, PullthroughResult } from '@/lib/types';

const SCOREABLE_AUTHORS = [
  // Press tier
  'TechCrunch', 'TechCrunch AI', 'The Verge', 'The Verge AI',
  'Ars Technica', 'Wired', 'VentureBeat', 'The Register',
  'MIT Tech Review', 'NYT Technology',
  // Research tier (expert framing matters)
  'arXiv cs.CL', 'arXiv cs.LG', 'IEEE Spectrum AI',
  'Towards Data Science',
  // High-credibility dev blogs
  'Simon Willison',
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getActiveKeyMessages(): Promise<KeyMessageRow[]> {
  const { data } = await supabaseAdmin
    .from('key_messages')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  return data || [];
}

export async function scoreMentionPullthrough(
  mentionId: string,
  title: string,
  body: string,
  source: string,
  author: string,
  keyMessages: KeyMessageRow[]
): Promise<PullthroughResult[]> {
  const prompt = `You are evaluating press/media coverage about Anthropic and Claude Code for message pull-through — measuring whether the company's intended key messages are reflected in the article.

ARTICLE:
Source: ${author || source}
Title: ${title}
Body: ${body?.substring(0, 3000) || 'No body text available'}

KEY MESSAGES TO EVALUATE:
${keyMessages.map((m, i) => `${i + 1}. [${m.shorthand}] "${m.message}"`).join('\n')}

For EACH key message, score how strongly it appears in the article:

- 0 = NOT PRESENT. The article does not mention, paraphrase, or imply this message at all.
- 1 = MENTIONED. The article touches on this theme — either through a direct paraphrase, a supporting quote, or a related claim. The message is present but not the article's focus.
- 2 = CENTRAL THEME. This message is a primary focus of the article. The headline, lead paragraph, or majority of the article's argument aligns with this message.

IMPORTANT SCORING RULES:
- Be strict. A passing mention of "AI safety" in paragraph 8 of a product review is a 0, not a 1. The mention must be substantive.
- Check FRAMING, not just keywords. "Claude Code saves developers time" (gain frame reflecting the productivity message) scores 1+. "Developers complain about Claude Code's speed" (loss frame about the same topic) scores 0 for the productivity message — it's undermining it, not reflecting it.
- For score 1 or 2, provide a brief evidence quote or paraphrase (max 15 words) showing WHERE the message appears in the article.
- For score 0, evidence should be null.
- Don't give credit for messages the journalist is explicitly contradicting or questioning. "Anthropic claims to lead on safety, but critics say..." is a 0 for safety leadership, not a 1.

Respond ONLY with a JSON array, no markdown fences:
[
  {"message_index": 0, "score": 1, "evidence": "brief quote or null"},
  {"message_index": 1, "score": 0, "evidence": null},
  ...
]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: '[' },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('Pull-through Claude API error:', data.error);
    throw new Error(`Claude API: ${data.error.message || JSON.stringify(data.error)}`);
  }

  if (!data.content || !data.content[0]) {
    throw new Error('Empty response from Claude for pull-through scoring');
  }

  const rawText = '[' + data.content[0].text;
  let cleaned = rawText;
  cleaned = cleaned.replace(/^```json\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.trim();

  try {
    const results = JSON.parse(cleaned);
    return results.map((r: { message_index: number; score: number; evidence: string | null }) => ({
      message_id: keyMessages[r.message_index]?.id,
      score: Math.min(2, Math.max(0, r.score)),
      evidence: r.evidence || null,
    })).filter((r: PullthroughResult) => r.message_id);
  } catch (e) {
    console.error('Pull-through parse error:', e, cleaned.substring(0, 300));
    return keyMessages.map(m => ({
      message_id: m.id,
      score: 0,
      evidence: null,
    }));
  }
}

export async function storePullthroughScores(
  mentionId: string,
  scores: PullthroughResult[]
) {
  const rows = scores.map(s => ({
    mention_id: mentionId,
    message_id: s.message_id,
    score: s.score,
    evidence: s.evidence,
  }));

  const { error } = await supabaseAdmin
    .from('pullthrough_scores')
    .upsert(rows, { onConflict: 'mention_id,message_id' });

  if (error) console.error('Pull-through store error:', error);
}

export async function scorePressmentions(): Promise<{
  scored: number;
  total_press: number;
  already_scored: number;
}> {
  const keyMessages = await getActiveKeyMessages();
  if (keyMessages.length === 0) {
    return { scored: 0, total_press: 0, already_scored: 0 };
  }

  // Find press-tier mentions that are classified
  const { data: pressMentions, error } = await supabaseAdmin
    .from('mentions')
    .select('id, title, body, source, author')
    .not('classified_at', 'is', null)
    .in('author', SCOREABLE_AUTHORS)
    .order('published_at', { ascending: false })
    .limit(50);

  if (error || !pressMentions) {
    console.error('Pull-through fetch error:', error);
    return { scored: 0, total_press: 0, already_scored: 0 };
  }

  if (pressMentions.length === 0) {
    return { scored: 0, total_press: 0, already_scored: 0 };
  }

  // Filter to unscored only
  const { data: scoredIds } = await supabaseAdmin
    .from('pullthrough_scores')
    .select('mention_id')
    .in('mention_id', pressMentions.map(m => m.id));

  const scoredSet = new Set((scoredIds || []).map((s: { mention_id: string }) => s.mention_id));
  const unscored = pressMentions.filter(m => !scoredSet.has(m.id));

  let scored = 0;
  for (const mention of unscored) {
    try {
      const results = await scoreMentionPullthrough(
        mention.id,
        mention.title || '',
        mention.body || '',
        mention.source,
        mention.author || '',
        keyMessages
      );
      await storePullthroughScores(mention.id, results);
      scored++;

      if (scored < unscored.length) {
        await delay(1000);
      }
    } catch (e) {
      console.error(`Pull-through error for ${mention.id}:`, e);
    }
  }

  return {
    scored,
    total_press: pressMentions.length,
    already_scored: scoredSet.size,
  };
}
