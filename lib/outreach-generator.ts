import type { SupabaseClient } from "@supabase/supabase-js";
import { logObservation } from "@/lib/observations";
import {
  department_chair_prompt,
  hackathon_organizer_prompt,
  pi_prompt,
  student_org_president_prompt,
  ta_prompt,
} from "@/lib/outreach-prompts";
import { supabaseAdmin } from "@/lib/supabase";
import type { Professor } from "@/lib/types";
import {
  isProfessorLinkedTargetType,
  type OutreachChannel,
  type OutreachDraftResult,
  type OutreachStage,
  type OutreachTargetType,
  type OutreachTouchpoint,
  type PaperMatchFactLine,
  type ReferencedFact,
} from "@/lib/types/outreach";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const STAGE_ORDER: OutreachStage[] = [
  "cold",
  "contacted",
  "meeting_booked",
  "demo_held",
  "partnership_active",
];

function mapProfessorRow(row: Record<string, unknown>): Professor {
  let public_statements: Professor["public_statements"] = [];
  const raw = row.public_statements;
  if (Array.isArray(raw)) {
    public_statements = raw as Professor["public_statements"];
  } else if (typeof raw === "string") {
    try {
      public_statements = JSON.parse(raw) as Professor["public_statements"];
    } catch {
      public_statements = [];
    }
  }

  return {
    id: row.id as string,
    institution_id: row.institution_id as string,
    name: row.name as string,
    title: (row.title as string | null) ?? undefined,
    lab_name: (row.lab_name as string | null) ?? undefined,
    arxiv_author_id: (row.arxiv_author_id as string | null) ?? undefined,
    homepage_url: (row.homepage_url as string | null) ?? undefined,
    recent_relevant_papers_count: Number(row.recent_relevant_papers_count ?? 0),
    ai_stance_quote: (row.ai_stance_quote as string | null) ?? undefined,
    ai_stance_source_url: (row.ai_stance_source_url as string | null) ?? undefined,
    public_statements,
    last_enriched_at: (row.last_enriched_at as string | null) ?? undefined,
  };
}

function usesProfessorContext(targetType: OutreachTargetType): boolean {
  return isProfessorLinkedTargetType(targetType);
}

function promptForTargetType(targetType: OutreachTargetType): string {
  switch (targetType) {
    case "professor":
      return pi_prompt;
    case "ta":
      return ta_prompt;
    case "department_chair":
      return department_chair_prompt;
    case "student_org":
      return student_org_president_prompt;
    case "hackathon_organizer":
      return hackathon_organizer_prompt;
    default:
      return pi_prompt;
  }
}

function abstractSnippet(abstract: unknown): string {
  if (typeof abstract !== "string" || !abstract.length) return "";
  return abstract.slice(0, 400);
}

export async function fetchPaperMatchLines(
  client: SupabaseClient,
  professorId: string,
  limit: number
): Promise<PaperMatchFactLine[]> {
  const { data, error } = await client
    .from("observations")
    .select("payload, observed_at, source_url")
    .eq("entity_type", "professor")
    .eq("entity_id", professorId)
    .eq("observation_type", "paper_matches_keywords")
    .order("observed_at", { ascending: false })
    .limit(limit * 3);

  if (error) throw error;

  const lines: PaperMatchFactLine[] = [];
  const seenTitles = new Set<string>();
  for (const row of data ?? []) {
    const payload = row.payload as Record<string, unknown>;
    const title = typeof payload.title === "string" ? payload.title : "";
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    lines.push({
      title,
      abstract_snippet: abstractSnippet(payload.abstract),
      observed_at: row.observed_at as string,
      source_url:
        typeof row.source_url === "string" ? row.source_url : undefined,
    });
    if (lines.length >= limit) break;
  }
  return lines;
}

async function fetchSyllabusPayloads(
  client: SupabaseClient,
  professorId: string
): Promise<Array<{ text: string; source_url?: string }>> {
  const { data, error } = await client
    .from("observations")
    .select("payload, source_url")
    .eq("entity_type", "professor")
    .eq("entity_id", professorId)
    .eq("observation_type", "syllabus_found")
    .order("observed_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const out: Array<{ text: string; source_url?: string }> = [];
  for (const row of data ?? []) {
    const p = row.payload as Record<string, unknown>;
    const line =
      typeof p.line === "string"
        ? p.line
        : typeof p.snippet === "string"
          ? p.snippet
          : typeof p.text === "string"
            ? p.text
            : JSON.stringify(p);
    if (line)
      out.push({
        text: line,
        source_url:
          typeof row.source_url === "string" ? row.source_url : undefined,
      });
  }
  return out;
}

/** Build grounded `referenced_facts` from professor row + observation-derived lines only. */
export function buildReferencedFactsFromProfessorContext(params: {
  paperLines: PaperMatchFactLine[];
  professor: Professor;
  syllabusLines: Array<{ text: string; source_url?: string }>;
}): ReferencedFact[] {
  const facts: ReferencedFact[] = [];
  for (const p of params.paperLines) {
    const text = `${p.title}\nAbstract snippet: ${p.abstract_snippet}`;
    facts.push({
      kind: "paper_match",
      text,
      source_url: p.source_url,
    });
  }
  if (params.professor.ai_stance_quote?.trim()) {
    facts.push({
      kind: "ai_stance",
      text: params.professor.ai_stance_quote.trim(),
      source_url: params.professor.ai_stance_source_url,
    });
  }
  for (const s of params.professor.public_statements ?? []) {
    if (s.quote?.trim()) {
      facts.push({
        kind: "public_statement",
        text: s.quote.trim(),
        source_url: s.source_url,
      });
    }
  }
  for (const s of params.syllabusLines) {
    if (s.text.trim()) {
      facts.push({
        kind: "syllabus",
        text: s.text.trim(),
        source_url: s.source_url,
      });
    }
  }
  return facts;
}

/** User-message block: verbatim titles + abstract snippets; instruction string is literal per product spec. */
export function buildProfessorArxivFactsBundle(params: {
  paperLines: PaperMatchFactLine[];
  professor: Professor;
  syllabusLines: Array<{ text: string; source_url?: string }>;
}): string {
  const paperBlock =
    params.paperLines.length > 0
      ? params.paperLines
          .map((p, i) => {
            return `${i + 1}. ${p.title}\n   Abstract snippet: ${p.abstract_snippet}`;
          })
          .join("\n\n")
      : "(none — no paper_matches_keywords observations yet.)";

  let extra = "";
  if (params.professor.ai_stance_quote?.trim()) {
    extra += `\n\nAI stance quote (verbatim):\n${params.professor.ai_stance_quote.trim()}`;
  }
  if (params.professor.public_statements?.length) {
    extra += `\n\nPublic statements (verbatim quotes):\n${params.professor.public_statements
      .map((s, i) => `${i + 1}. ${s.quote}`)
      .join("\n")}`;
  }
  if (params.syllabusLines.length) {
    extra += `\n\nSyllabus lines (verbatim from observations):\n${params.syllabusLines
      .map((s, i) => `${i + 1}. ${s.text}`)
      .join("\n")}`;
  }

  return `Reference only the following facts from this professor's arxiv pipeline:

Paper titles (verbatim) with abstract snippets:
${paperBlock}${extra}

Do not paraphrase paper titles. Use only the facts above plus the professor name and institution provided outside this block.`;
}

function buildTemplateDraft(params: {
  professorName: string;
  institutionName: string;
  referenced_facts: ReferencedFact[];
}): Pick<OutreachDraftResult, "subject_line" | "body" | "tone"> {
  const titles = params.referenced_facts
    .filter((f) => f.kind === "paper_match")
    .map((f) => f.text.split("\n")[0])
    .filter(Boolean);
  const titleRef = titles[0] ?? "your recent work";

  return {
    subject_line: `Cursor for students — ${params.institutionName} (${titleRef.slice(0, 60)})`,
    tone: "concise",
    body: `Hi ${params.professorName},

I'm the Cursor Campus Lead reaching out about our student/education program and faculty-friendly resources for AI-assisted programming courses.

I noticed this line of work in our pipeline: ${titleRef}. If you are open to a short note on how other CS departments partner with Cursor, I would welcome a reply.

Best,
Cursor Campus Lead`,
  };
}

async function callClaudeJsonDraft(params: {
  systemPrompt: string;
  userMessage: string;
}): Promise<{ subject_line: string; body: string; tone: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: `${params.systemPrompt}

Return ONLY a JSON object with keys: subject_line (string), body (string), tone (string). No markdown fences.`,
      messages: [
        { role: "user", content: params.userMessage },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ text?: string }>;
  };

  if (data.error) {
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  }

  const piece = data.content?.[0]?.text;
  if (!piece) throw new Error("Empty Claude response");

  let cleaned = "{" + piece;
  cleaned = cleaned.replace(/^```json\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?```\s*$/gm, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid JSON from Claude");
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  }

  const subject_line =
    typeof parsed.subject_line === "string" ? parsed.subject_line : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  const tone = typeof parsed.tone === "string" ? parsed.tone : "professional";
  if (!subject_line || !body) throw new Error("Claude JSON missing fields");
  return { subject_line, body, tone };
}

export function allowedNextOutreachStages(
  from: OutreachStage
): OutreachStage[] {
  if (from === "dead") return [];
  const idx = STAGE_ORDER.indexOf(from);
  const next: OutreachStage[] = ["dead"];
  if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
    next.unshift(STAGE_ORDER[idx + 1]!);
  }
  return next;
}

export function isLegalOutreachTransition(
  from: OutreachStage,
  to: OutreachStage
): boolean {
  if (from === to) return true;
  if (to === "dead") return from !== "dead";
  if (from === "dead") return false;
  return allowedNextOutreachStages(from).includes(to);
}

export async function generateOutreachDraft(
  targetType: OutreachTargetType,
  targetId: string,
  options?: {
    supabase?: SupabaseClient;
    touchpointId?: string;
    /** Institution display name for prompts */
    institutionName?: string;
  }
): Promise<OutreachDraftResult> {
  const client = options?.supabase ?? supabaseAdmin;

  let professor: Professor | null = null;
  let institutionName = options?.institutionName ?? "";
  let paperLines: PaperMatchFactLine[] = [];
  let syllabusLines: Array<{ text: string; source_url?: string }> = [];
  let referenced_facts: ReferencedFact[] = [];

  if (usesProfessorContext(targetType)) {
    const { data: row, error } = await client
      .from("professors")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      referenced_facts = [];
      const empty: OutreachDraftResult = {
        subject_line: "Outreach draft",
        body: `We could not load professor id "${targetId}". After seed data is available, regenerate this draft.`,
        tone: "neutral",
        referenced_facts,
      };
      if (options?.touchpointId) {
        await logObservation({
          entity_type: "outreach",
          entity_id: options.touchpointId,
          observation_type: "outreach_drafted",
          payload: {
            target_type: targetType,
            target_id: targetId,
            subject_line: empty.subject_line,
            referenced_facts,
            tone: empty.tone,
            template: true,
            error: "professor_not_found",
          },
          source: "manual",
          confidence: 1,
        });
      }
      return empty;
    }

    professor = mapProfessorRow(row as Record<string, unknown>);

    if (!institutionName) {
      const { data: inst } = await client
        .from("institutions")
        .select("name")
        .eq("id", professor.institution_id)
        .maybeSingle();
      institutionName =
        (inst?.name as string | undefined) ?? professor.institution_id;
    }

    paperLines = await fetchPaperMatchLines(client, targetId, 3);
    syllabusLines = await fetchSyllabusPayloads(client, targetId);
    referenced_facts = buildReferencedFactsFromProfessorContext({
      paperLines,
      professor,
      syllabusLines,
    });

    const factsBundle = buildProfessorArxivFactsBundle({
      paperLines,
      professor,
      syllabusLines,
    });

    const systemPrompt = promptForTargetType(targetType);
    const userMessage = `Professor name: ${professor.name}
Institution: ${institutionName}

${factsBundle}`;

    let subject_line: string;
    let body: string;
    let tone: string;
    let usedTemplate = false;

    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("no key");
      }
      const parsed = await callClaudeJsonDraft({ systemPrompt, userMessage });
      subject_line = parsed.subject_line;
      body = parsed.body;
      tone = parsed.tone;
    } catch {
      usedTemplate = true;
      const t = buildTemplateDraft({
        professorName: professor.name,
        institutionName,
        referenced_facts,
      });
      subject_line = t.subject_line;
      body = t.body;
      tone = t.tone;
    }

    const result: OutreachDraftResult = {
      subject_line,
      body,
      tone,
      referenced_facts,
    };

    if (options?.touchpointId) {
      await logObservation({
        entity_type: "outreach",
        entity_id: options.touchpointId,
        observation_type: "outreach_drafted",
        payload: {
          target_type: targetType,
          target_id: targetId,
          subject_line: result.subject_line,
          referenced_facts: result.referenced_facts,
          tone: result.tone,
          template: usedTemplate,
        },
        source: usedTemplate ? "manual" : "classification",
        confidence: usedTemplate ? 1 : 0.75,
      });
    }

    return result;
  }

  // Non-professor targets: minimal grounded context (org observations optional later)
  referenced_facts = [];
  const systemPrompt = promptForTargetType(targetType);
  const userMessage = `Target type: ${targetType}
Target id: ${targetId}
No professor arxiv pipeline facts are attached for this target type. Write a brief, honest introduction offering to follow up with specifics once you learn more about their org or event.`;

  let subject_line = "Cursor campus partnership";
  let body = `Hello,\n\nI'm the Cursor Campus Lead. I would love to learn more about your work (${targetType}, ${targetId}) and share how we support student orgs and hackathons with Cursor.\n\nBest,\nCursor Campus Lead`;
  let tone = "friendly";
  let usedTemplate = !process.env.ANTHROPIC_API_KEY;

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const parsed = await callClaudeJsonDraft({ systemPrompt, userMessage });
      subject_line = parsed.subject_line;
      body = parsed.body;
      tone = parsed.tone;
      usedTemplate = false;
    }
  } catch {
    usedTemplate = true;
  }

  const result: OutreachDraftResult = {
    subject_line,
    body,
    tone,
    referenced_facts,
  };

  if (options?.touchpointId) {
    await logObservation({
      entity_type: "outreach",
      entity_id: options.touchpointId,
      observation_type: "outreach_drafted",
      payload: {
        target_type: targetType,
        target_id: targetId,
        subject_line: result.subject_line,
        referenced_facts: result.referenced_facts,
        tone: result.tone,
        template: usedTemplate,
      },
      source: usedTemplate ? "manual" : "classification",
      confidence: usedTemplate ? 1 : 0.75,
    });
  }

  return result;
}

export function mapOutreachTouchpointRow(
  row: Record<string, unknown>
): OutreachTouchpoint {
  return {
    id: row.id as string,
    target_type: row.target_type as OutreachTargetType,
    target_id: row.target_id as string,
    target_name: row.target_name as string,
    stage: row.stage as OutreachStage,
    channel: row.channel as OutreachChannel,
    subject_line: (row.subject_line as string) ?? "",
    draft_content: (row.draft_content as string) ?? "",
    sent_at: (row.sent_at as string | null) ?? null,
    reply_detected_at: (row.reply_detected_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
  };
}
