import fs from 'fs';
import path from 'path';
import type { GeneratedScore, InstrumentSpec } from '@/types';
import { generateId } from '@/lib/utils';

const FILES_URL = 'https://api.x.ai/v1/files';
const RESPONSES_URL = 'https://api.x.ai/v1/responses';
const ELEVENLABS_MUSIC_API = 'https://api.elevenlabs.io/v1/music';
const OUTPUT_FORMAT = 'mp3_44100_128';
const MUSIC_MODEL_ID = 'music_v2_5';

/** Prompt sent to Grok by both the studio generate route and scripts/test-grok-video.ts. */
export const GROK_COMPOSITION_PROMPT = `Watch and understand the entire attached video before making any musical decisions.

You are creating a temporally aligned semantic composition plan for ElevenLabs Music.

IMPORTANT STRUCTURAL CONSTRAINT:

ElevenLabs Music composition-plan chunks should be at least 3000 ms whenever the video is long enough for that constraint to be satisfiable.

Consider this constraint FROM THE BEGINNING while analyzing the video and deciding the musical structure.

Do not first create an ideal unconstrained segmentation and then mechanically force it into 3000 ms chunks afterward.

Instead, jointly reason about:
- the true timing and importance of visual events
- the narrative hierarchy of those events
- which events deserve actual chunk boundaries
- which nearby or secondary events should be represented as internal musical changes within a larger chunk
- the 3000 ms chunk constraint
- preservation of the most important temporal alignment

Treat chunk boundaries as a limited structural resource.

Not every meaningful visual event needs its own chunk.

When multiple important events are too close together to support separate chunks of at least 3000 ms, decide which event is more important to preserve as a structural boundary.

Prefer preserving the boundary that best represents the video's primary narrative or musical turning point.

Represent the other event inside the surrounding chunk using temporal language in positive_styles, such as an internal accent, rise, suspension, shift, release, or other appropriate musical behavior.

Never move an important event to a false timestamp merely to satisfy the minimum chunk duration.

If the entire video itself is 3000 ms or shorter, use exactly one chunk whose duration_ms equals the exact full video duration.

In that short-video case, the chunk may be shorter than 3000 ms.

Describe any important internal event and the musical evolution around it within positive_styles rather than inventing additional chunk boundaries or padding the duration.

Your job is NOT to fully orchestrate the soundtrack yourself.

Your job is to understand the video, determine its narrative and perceptual structure, decide WHEN musically important events should happen, WHY they matter, WHAT they should feel like musically, and HOW musical energy should evolve over time.

ElevenLabs Music should retain meaningful creative freedom over the exact sonic realization.

Think conceptually in this direction:

VISUAL SEMANTICS
→ NARRATIVE / PERCEPTUAL MEANING
→ MUSICAL SEMANTICS
→ ELEVENLABS SONIC REALIZATION

Do not output this reasoning chain.

First watch the complete video and infer its overall musical identity from the video itself, including:
- genre or broad musical language
- approximate tempo and sense of motion
- tonal and emotional character
- rhythm and groove
- bass behavior
- harmonic character
- melodic character
- texture
- density
- dynamics
- overall musical arc

Instrumentation and playing techniques may be suggested when they help establish the musical identity, but do not over-orchestrate every visual event.

The temporal, semantic, and dynamic instructions are more important than prescribing exact instruments.

Identify the important visual events and their timing from the complete video.

Before deciding whether the soundtrack should revolve around a primary impact,
determine the video's overall TEMPORAL GRAMMAR from the complete video.

Different videos organize meaningful moments differently.

The video may be primarily:
- event-driven, with one clearly dominant narrative, physical, or emotional event
- transition-driven, with recurring cuts, match cuts, repeated gestures, reveals, or scene changes
- rhythm-driven, with repeated movements or editing patterns that suggest recurring musical accents
- progression-driven, where meaning comes from gradual emotional, visual, or energetic development
- phase-driven, with several major sections of comparable importance
- or another temporal structure inferred from the video

These categories are conceptual possibilities, not labels that must appear in
the output and not a fixed classification system.

Infer the temporal grammar independently from the actual video.

Do NOT force every video into a single-primary-impact structure.

If the video contains one clearly dominant event, use the primary-impact
framework described below.

If the video does NOT contain one clearly dominant event, do not arbitrarily
invent a primary impact merely to create a climax.

Instead, construct the musical hierarchy around the video's actual temporal
organization.

For transition-driven, montage-like, travel, lifestyle, dance, social, or
rapidly edited videos, pay particular attention to:
- editing rhythm
- cuts and match cuts
- repeated visual compositions
- repeated gestures or movements
- camera transitions
- scene reveals
- recurring visual motifs
- changes of location, scale, motion, brightness, or emotional tone

These may deserve recurring musical accents, rhythmic changes, phrase
boundaries, textural shifts, harmonic changes, or progressive changes in
energy rather than separate composition-plan chunks.

Repeated events do not all need equal musical weight.

Infer their relative importance and allow them to form patterns, phrases,
expectations, variations, and larger-scale musical development.

A sequence of recurring visual transitions may therefore produce a coherent
rhythmic or phrase-level musical pattern rather than a sequence of unrelated
mini-climaxes.

Pay attention to BOTH:
- semantic/narrative timing
- editing/rhythmic timing

Determine whether the music should primarily synchronize to:
- narrative events
- physical events
- editing rhythm
- repeated visual motifs
- emotional progression
- or an appropriate combination of these

Make this decision from the complete video before choosing chunk boundaries.

For important events, interpret not only what physically happens, but what the event means perceptually and narratively.

Useful perceptual concepts may include:
- anticipation
- acceleration
- suspension
- instability
- weight
- momentum
- tension
- release
- impact
- fluidity
- expansion
- contraction
- openness
- density
- brightness
- darkness
- playfulness
- danger
- calm
- resolution

These are examples only. Infer the appropriate semantics independently from the actual video.

Translate visual properties into musical-perceptual properties.

For example:
- upward or accelerating motion may suggest rising tension, lift, expansion, or increasing momentum
- collision or physical consequence may suggest sudden weight, sharpness, impact, or explosive release
- water or fluid motion may suggest fluidity, spreading energy, shimmering texture, diffusion, bloom, or rippling decay
- open space may suggest width, air, spaciousness, or sustained resonance

These are examples of semantic translation, not fixed mappings and not instructions to force these behaviors into every video.

Do not request literal Foley or literal sound effects.

The soundtrack must remain a coherent piece of music.

However, allow ElevenLabs enough creative freedom to discover timbres, textures, and sound-design-like musical qualities that naturally correspond to the visual semantics.

Do not unnecessarily prescribe rigid event realizations such as:
"kick + floor tom + distorted guitar + bass drop + synth stab"

when a semantic instruction such as:
"a sudden massive, fluid, wide-spectrum musical impact that blooms outward into a spacious shimmering decay"
would communicate the intended perceptual effect more effectively.

Specific instrumentation is still allowed when it is genuinely important to the musical identity or semantic effect.

Choose one primary impact if the video contains a clear dominant event.

The primary impact is the single visual, physical, narrative, or emotional moment that deserves the strongest musical impact in the entire soundtrack.

Do not automatically choose the moment of maximum motion.

Distinguish an action or motion peak from its narrative payoff, physical consequence, emotional climax, reveal, landing, collision, transformation, or resolution.

For example, an airborne action may deserve a secondary musical accent while its later physical consequence may deserve the primary impact.

This is only an example of reasoning. Determine the actual hierarchy independently from the video.

Secondary events should still influence the music, but they must remain perceptually subordinate to the primary impact.

They may influence:
- rhythmic intensity
- percussion
- bass
- harmony
- melody
- texture
- density
- dynamics
- timbre
- spatial character
- tension

Do not create a separate musical section for every visual event.

Divide the complete video into musically meaningful chunks based on major changes in narrative and musical function while respecting the structural constraints described above.

For videos longer than 3000 ms, construct the composition plan so that each chunk is at least 3000 ms by making intelligent boundary choices during the initial temporal analysis, rather than by moving meaningful events after the fact.

All chunks together must cover the complete video with no gaps and no overlaps.

The sum of duration_ms across all chunks must equal the full video duration in milliseconds.

When the video contains a clear primary impact, the primary-impact timestamp should be a chunk boundary whenever this is compatible with the minimum chunk duration and the overall event geometry.

If preserving the exact primary-impact timestamp as a chunk boundary would necessarily create a chunk shorter than 3000 ms, do not move the primary impact to a false timestamp merely to create a legal boundary.

Instead, preserve its true timing as an internal event within the appropriate chunk and describe its exact relative timing and musical behavior clearly in positive_styles.

Once you determine the primary-impact timestamp T, treat T as the exact UNIQUE GLOBAL MUSICAL PEAK of the entire composition.

This is a strict temporal rule.

The primary impact is NOT an entire high-intensity section.

Whenever T is represented by a chunk boundary, the primary impact is a precise musical moment occurring at the first instant of the chunk beginning at T.

When T cannot legally be represented as a chunk boundary because of the minimum chunk duration, it must remain a precise internal musical moment at its true time within the containing chunk.

In either case, the musical peak must remain aligned to the true visual event.

At exactly T:
- the single strongest transient of the entire composition occurs
- maximum dynamic intensity occurs
- maximum perceptual impact occurs
- accumulated tension receives its strongest release or transformation
- this moment is unmistakably stronger than every secondary event

No musical moment before T may equal or exceed the primary impact.

No musical moment after T may equal or exceed the primary impact.

When T is a chunk boundary, the chunk immediately BEFORE T must build toward T while withholding the unique maximum.

When T is an internal event because a legal boundary is impossible, the portion of the containing chunk before T must serve the same function: it must build toward T while withholding the unique maximum.

It may already be rich, exciting, complex, energetic, rhythmically active, and musically interesting.

"Not maximum intensity yet" does NOT mean quiet, empty, sparse, generic, or boring.

But it must preserve perceptual headroom for T.

When appropriate, explicitly describe trajectories such as:
- increasing energy
- continuous crescendo
- increasing rhythmic intensity
- increasing percussion density
- increasing bass weight
- expanding texture
- increasing harmonic tension
- increasing momentum

The exact trajectory should come from the video rather than from a fixed template.

If secondary events occur before T, they may receive clear internal musical accents, but those accents must remain weaker than T.

The negative_styles of the musical region before T should actively prevent:
- premature maximum intensity
- a full climax before T
- a transient equal to the primary impact
- early resolution of the accumulated tension
when those constraints are appropriate.

When a chunk STARTS at T, it must make its first instant the unique global maximum.

Do not slowly build toward the impact after the chunk has already begun.

Do not delay the climax.

Do not spread maximum intensity across the entire chunk.

The first instant is the peak.

When T must occur inside a chunk because a legal boundary is impossible, explicitly describe the timing of the internal peak relative to the start of that chunk as accurately as possible.

For example, if the true primary impact occurs approximately 1.8 seconds after the start of the containing chunk, positive_styles should explicitly state that the unique maximum impact occurs approximately 1.8 seconds into the chunk.

Do not use this example timing unless it matches the actual video.

After that immediate peak, the music should move away from the maximum according to the visual semantics.

It may:
- release
- decay
- resolve
- diffuse
- bloom outward
- thin out
- transform
- become spacious
- continue with reduced intensity
- transition into another emotional state

Choose the behavior from the actual video.

For a visually distinctive event, describe the perceptual character of the impact rather than over-prescribing the orchestration.

For example, if the primary event is visually fluid, the musical instruction may describe a heavy immediate impact that spreads outward, blooms, shimmers, diffuses, or ripples during its decay.

If the event is hard, mechanical, abrupt, soft, elastic, airy, chaotic, intimate, or expansive, translate those properties into musical semantics appropriately.

Do not copy these examples blindly.

The negative_styles of the primary-impact region should actively prevent:
- a slow build continuing past the true impact time
- delayed impact
- a weak impact
- sustained maximum intensity after the impact
- a later stronger transient
- a competing second climax

After the primary impact, later events may still influence the music and may be musically interesting, but they must not create a new global maximum unless the video genuinely has no single dominant event.

Maintain a clear GLOBAL DYNAMIC ENVELOPE.

The listener should be able to perceive meaningful differences between the musical functions of the chunks even without seeing the video.

For every chunk, positive_styles should communicate both:

1. MACRO TEMPORAL BEHAVIOR
- approximate starting energy
- approximate ending energy
- whether energy is stable, increasing, decreasing, releasing, or transforming
- rhythmic-intensity trajectory
- density and texture trajectory
- dynamic trajectory
- tension and release

2. MUSICAL / PERCEPTUAL CHARACTER
- emotional and narrative function
- perceptual qualities derived from the visuals
- groove and rhythmic character
- harmonic and melodic character
- timbre and texture
- instrumentation or playing techniques when useful

Macro temporal behavior and perceptual meaning have higher priority than detailed orchestration.

Rich musical content must not flatten the global dynamic hierarchy.

Use explicit trajectory language when useful, such as:
- restrained
- low energy
- moderate energy
- gradually increasing
- continuous crescendo
- increasing rhythmic intensity
- increasing density
- expanding texture
- accelerating momentum
- maximum intensity immediately at entrance
- immediate release
- decreasing energy
- decreasing percussion
- thinning texture
- spacious decay
- soft resolution

These are examples, not mandatory vocabulary and not a fixed musical structure.

Choose the trajectory independently from the actual video.

If a secondary event occurs too close to the primary impact to create two legal chunks of at least 3000 ms, do not move the primary-impact boundary merely to accommodate the secondary event.

Preserve the more important boundary and express the secondary event as an internal musical accent in the surrounding chunk.

If no legal chunk arrangement can preserve the primary-impact timestamp as a boundary without creating a chunk shorter than 3000 ms, preserve the true primary-impact timing internally rather than falsifying its timestamp.

The music must remain one coherent composition rather than a sequence of unrelated musical reactions or sound effects.

Use positive_styles to describe what SHOULD happen musically.

Use negative_styles actively and selectively to protect the intended temporal and dynamic hierarchy.

Do not copy identical negative_styles into every chunk.

Choose section names from the actual musical and narrative function of each chunk.

Names such as [Approach], [Build], [Impact], and [Resolution] are examples of the kind of functional naming that may be useful.

Do NOT force those four sections.

Choose the number of chunks, their boundaries, and their names independently from the actual video while respecting the structural constraints from the beginning of the analysis.

Output only this assignment:

composition_plan = {
    "chunks": [
        {
            "text": "[Section Name]",
            "duration_ms": <integer>,
            "positive_styles": [
                "<semantic and temporal musical instruction>"
            ],
            "negative_styles": [
                "<musical constraint protecting the intended hierarchy>"
            ],
            "context_adherence": "high"
        }
    ]
}

No explanation.
No reasoning.
No markdown fences.
No video description before the plan.
No text after the plan.

Before returning the answer, privately verify:

- the complete video was considered
- the 3000 ms chunk constraint was considered during the initial temporal analysis rather than applied mechanically afterward
- chunk boundaries were inferred jointly from video semantics, event hierarchy, and structural constraints
- meaningful event timestamps were not falsified merely to satisfy the minimum chunk duration
- nearby secondary events were represented internally when giving each one a separate boundary would damage the more important temporal structure
- if the entire video is 3000 ms or shorter, exactly one chunk covers its exact full duration
- for videos longer than 3000 ms, every chunk is at least 3000 ms
- the primary impact was selected from the whole narrative
- the primary impact is not automatically the maximum-motion moment
- if there is a clear primary impact, its exact timestamp is a chunk boundary whenever structurally possible
- if the primary impact cannot legally be a boundary, its true timing is preserved explicitly as an internal event rather than moved
- the strongest musical transient occurs exactly at the true primary-impact time
- that instant is the unique global musical maximum
- earlier secondary events remain perceptually subordinate
- the music before the primary impact preserves enough headroom for it
- energy moves away from the maximum after the primary impact
- there is no competing second climax
- the plan describes visual and narrative semantics rather than merely prescribing instrumentation
- ElevenLabs retains creative freedom over detailed sonic realization
- chunks cover the complete video
- duration_ms sums exactly to the video duration
- the music remains rich, coherent, and temporally expressive

If any check fails, revise the plan before returning it.

Do not output this checklist.`;

export interface GrokCompositionPlan {
  chunks: Array<{
    text: string;
    duration_ms: number;
    positive_styles: string[];
    negative_styles: string[];
    context_adherence: string;
  }>;
}

export interface ApiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/** Model id from XAI_MODEL in .env.local. Falls back to the model the video test already used. */
export function grokModel(): string {
  return process.env.XAI_MODEL?.trim() || 'grok-4.7';
}

export async function uploadVideoToXai(apiKey: string, videoPath: string): Promise<ApiResult> {
  const bytes = fs.readFileSync(videoPath);
  const form = new FormData();
  form.append('purpose', 'assistants');
  form.append('file', new Blob([bytes], { type: 'video/mp4' }), path.basename(videoPath));
  const response = await fetch(FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  return { ok: response.ok, status: response.status, body: await readBody(response) };
}

export async function askGrokForPlan(apiKey: string, fileId: string): Promise<ApiResult> {
  const response = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: grokModel(),
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: GROK_COMPOSITION_PROMPT },
            { type: 'input_file', file_id: fileId },
          ],
        },
      ],
    }),
  });
  return { ok: response.ok, status: response.status, body: await readBody(response) };
}

export function readFileId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.id === 'string' && record.id.length > 0) return record.id;
  if (typeof record.file_id === 'string' && record.file_id.length > 0) return record.file_id;
  return null;
}

export function extractOutputText(body: unknown): string {
  const parts: string[] = [];
  collectOutputText(body, parts);
  return parts.join('\n').trim();
}

export function parseCompositionPlan(outputText: string): GrokCompositionPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(compositionPlanJson(outputText));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON.parse failed: ${message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('composition_plan is not an object.');
  }
  const plan = parsed as Record<string, unknown>;
  if (!Array.isArray(plan.chunks)) {
    throw new Error('compositionPlan.chunks is missing or is not an array.');
  }
  plan.chunks.forEach((chunk, index) => {
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
      throw new Error(`chunks[${index}] is not an object.`);
    }
    const record = chunk as Record<string, unknown>;
    for (const key of ['text', 'duration_ms', 'positive_styles', 'negative_styles', 'context_adherence'] as const) {
      if (!(key in record)) throw new Error(`chunks[${index}] is missing ${key}.`);
    }
    if (typeof record.text !== 'string') throw new Error(`chunks[${index}].text is not a string.`);
    if (typeof record.duration_ms !== 'number' || !Number.isFinite(record.duration_ms)) {
      throw new Error(`chunks[${index}].duration_ms is not a number.`);
    }
    if (!isStringArray(record.positive_styles)) throw new Error(`chunks[${index}].positive_styles is not a string array.`);
    if (!isStringArray(record.negative_styles)) throw new Error(`chunks[${index}].negative_styles is not a string array.`);
    if (typeof record.context_adherence !== 'string') throw new Error(`chunks[${index}].context_adherence is not a string.`);
  });
  return plan as unknown as GrokCompositionPlan;
}

/** Sends the parsed plan to ElevenLabs unchanged and writes an mp3 under public/generated. */
export async function composeMusicFile(plan: GrokCompositionPlan, filename: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set. Add it to .env.local.');
  }

  const response = await fetch(`${ELEVENLABS_MUSIC_API}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: MUSIC_MODEL_ID,
      composition_plan: plan,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs Music ${response.status}: ${errorText || '(empty response)'}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error('ElevenLabs Music returned an empty audio response.');
  }

  const outputDir = path.join(process.cwd(), 'public', 'generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

export async function generateScoreFromVideo(videoPath: string): Promise<GeneratedScore> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not set. Add it to .env.local.');
  }

  const model = grokModel();
  console.log(`[generate] Grok model ${model}`);

  const upload = await uploadVideoToXai(apiKey, videoPath);
  if (!upload.ok) {
    throw new Error(`Grok file upload failed (HTTP ${upload.status}): ${stringify(upload.body)}`);
  }
  const fileId = readFileId(upload.body);
  if (!fileId) {
    throw new Error('Grok file upload did not return a file id.');
  }

  const grok = await askGrokForPlan(apiKey, fileId);
  if (!grok.ok) {
    throw new Error(`Grok request failed (HTTP ${grok.status}): ${stringify(grok.body)}`);
  }

  const outputText = extractOutputText(grok.body);
  const plan = parseCompositionPlan(outputText);
  const id = generateId();
  const filename = `${id}.mp3`;
  await composeMusicFile(plan, filename);

  const durationMs = plan.chunks.reduce((sum, chunk) => sum + chunk.duration_ms, 0);
  const durationSeconds = Math.round((durationMs / 1000) * 10) / 10;
  const emptySpec: InstrumentSpec = { drums: [], bass: [], vocals: [], melody: [] };
  const prompt = plan.chunks
    .map((chunk) => `${chunk.text}\n${chunk.positive_styles.join('\n')}`)
    .join('\n\n');

  return {
    audioUrl: `/generated/${filename}`,
    durationSeconds,
    bpm: 0,
    genre: 'score',
    mood: 'emotional',
    filename: 'grok-score.mp3',
    prompt,
    backendPrompt: JSON.stringify(plan),
    instrumentSpec: emptySpec,
    sections: plan.chunks.map((chunk) => ({
      name: chunk.text,
      durationSeconds: Math.round((chunk.duration_ms / 1000) * 10) / 10,
      styles: chunk.positive_styles,
    })),
  };
}

export function assertUploadedVideoPath(videoPath: string): string {
  const uploads = path.resolve(process.cwd(), 'public', 'uploads');
  const resolved = path.resolve(videoPath);
  const relative = path.relative(uploads, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Video path is not an uploaded file.');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('Uploaded video was not found.');
  }
  return resolved;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return '';
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function collectOutputText(value: unknown, parts: string[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectOutputText(item, parts);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === 'output_text' && typeof record.text === 'string') {
    parts.push(record.text);
    return;
  }
  for (const child of Object.values(record)) collectOutputText(child, parts);
}

function compositionPlanJson(outputText: string): string {
  let source = outputText.trim();
  const wrapped = source.match(/^```(?:python|json)?\s*([\s\S]*?)\s*```$/);
  if (wrapped?.[1]) source = wrapped[1].trim();
  const marker = 'composition_plan =';
  const at = source.indexOf(marker);
  if (at >= 0) source = source.slice(at + marker.length).trim();
  const start = source.indexOf('{');
  if (start < 0) throw new Error('The Grok output did not contain a composition_plan object.');
  const end = matchingBrace(source, start);
  if (end < 0) throw new Error('The Grok composition_plan object was not closed.');
  return source.slice(start, end + 1);
}

function matchingBrace(source: string, start: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
