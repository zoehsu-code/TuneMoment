import type { CompositionPlan, MusicSection, TimelineSegment, VideoAnalysis } from '@/types';
import type { TemporalEvent } from '@/lib/providers/analysis/extractTemporalEvents';
import { buildCompositionPlan } from './buildCompositionPlan';

// ElevenLabs Music sections are 3–120s. Accepted event times stay at millisecond precision.
const MIN_SECTION_MS = 3000;
const MAX_SECTION_MS = 120_000;
const MAX_NAME_CHARS = 100;
const MAX_STYLE_CHARS = 100;

const VISUAL_LEAK =
  /\b(video|scene|shot|frame|footage|depicts|shows|we see|camera|figure|person|man|woman|people|viewer)\b/i;

const ROLE_HINT: Record<string, string> = {
  intro: 'gentle introduction',
  'rising action': 'building intensity',
  climax: 'full arrangement, climactic peak',
  'falling action': 'easing tension',
  resolution: 'resolving, settling cadence',
};

interface RankedEvent {
  event: TemporalEvent;
  ms: number;
  priority: number;
}

interface PlannedSpan {
  startMs: number;
  endMs: number;
  /** Visual event that opens this section, when this cut is an accepted event boundary. */
  boundary: RankedEvent | null;
  internal: RankedEvent[];
  /** True when this cut was inserted only to keep a section under 120s. */
  synthetic: boolean;
}

/**
 * Event-aligned composition plan.
 *
 * Cuts are the analyzed timeline boundaries plus accepted visual-event
 * times. An event time is never moved. An original boundary is kept when it
 * still leaves every neighboring section at least 3 seconds long, and dropped
 * when it sits too close to an accepted event. Global musical direction still
 * comes from the baseline planner, which this module does not modify.
 */
export function buildAlignedCompositionPlan(
  analysis: VideoAnalysis,
  events: readonly TemporalEvent[],
  durationSeconds: number,
): CompositionPlan {
  const durationMs = resolveDurationMs(durationSeconds);
  const ranked = rankEvents(events);
  const primary = ranked[0] ?? null;
  const { boundaries, internal } = selectEventBoundaries(ranked, durationMs);
  const cuts = composeCuts(boundaries, analysis.timeline ?? [], durationMs);
  const spans = assignInternalEvents(buildSpans(cuts, boundaries), internal);
  const globals = globalStyles(analysis, durationSeconds);
  const acceptedPrimary = boundaries.find((boundary) => primary && boundary.event.id === primary.event.id) ?? null;

  const sections: MusicSection[] = spans.map((span, index) =>
    buildAlignedSection(analysis, spans, index, acceptedPrimary),
  );

  return {
    positive_global_styles: globals.positive,
    negative_global_styles: globals.negative,
    sections,
  };
}

/** (salience + eventScore) / 2. The highest priority event is the primary event. */
function eventPriority(event: TemporalEvent): number {
  return (event.salience + event.eventScore) / 2;
}

function rankEvents(events: readonly TemporalEvent[]): RankedEvent[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter(
      (event) =>
        !!event &&
        Number.isFinite(event.timeSeconds) &&
        Number.isFinite(event.salience) &&
        Number.isFinite(event.eventScore),
    )
    .map((event) => ({
      event,
      ms: Math.round(event.timeSeconds * 1000),
      priority: eventPriority(event),
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.ms !== b.ms) return a.ms - b.ms;
      return a.event.id.localeCompare(b.event.id);
    });
}

/**
 * Higher-priority events are considered first. A time becomes a structural
 * boundary only when the sections on both sides are at least 3 seconds and it
 * is at least 3 seconds from every event boundary already accepted.
 */
function selectEventBoundaries(
  ranked: RankedEvent[],
  durationMs: number,
): { boundaries: RankedEvent[]; internal: RankedEvent[] } {
  const boundaries: RankedEvent[] = [];
  const internal: RankedEvent[] = [];

  for (const candidate of ranked) {
    const clearsEnds =
      candidate.ms >= MIN_SECTION_MS && candidate.ms <= durationMs - MIN_SECTION_MS;
    const clearsNeighbors = boundaries.every(
      (chosen) => Math.abs(chosen.ms - candidate.ms) >= MIN_SECTION_MS,
    );
    if (clearsEnds && clearsNeighbors) boundaries.push(candidate);
    else internal.push(candidate);
  }

  boundaries.sort((a, b) => a.ms - b.ms);
  return { boundaries, internal };
}

/**
 * Start from the accepted event cuts, then add each original timeline boundary
 * that is still at least 3 seconds from every cut already chosen. Event times
 * are inserted first, so a conflicting original boundary is the one that drops.
 */
function composeCuts(
  eventBoundaries: RankedEvent[],
  timeline: TimelineSegment[],
  durationMs: number,
): number[] {
  const cuts = [0, durationMs, ...eventBoundaries.map((boundary) => boundary.ms)];
  for (const ms of originalBoundaryMs(timeline, durationMs)) {
    if (cuts.some((cut) => Math.abs(cut - ms) < MIN_SECTION_MS)) continue;
    cuts.push(ms);
  }
  return uniqueSorted(cuts);
}

function originalBoundaryMs(timeline: TimelineSegment[], durationMs: number): number[] {
  const points = new Set<number>();
  for (const segment of timeline) {
    for (const seconds of [segment.startSeconds, segment.endSeconds]) {
      if (!Number.isFinite(seconds)) continue;
      const ms = Math.round(seconds * 1000);
      if (ms > 0 && ms < durationMs) points.add(ms);
    }
  }
  return [...points].sort((a, b) => a - b);
}

function buildSpans(cuts: number[], eventBoundaries: RankedEvent[]): PlannedSpan[] {
  const eventAt = new Map(eventBoundaries.map((boundary) => [boundary.ms, boundary]));
  const requested = new Set(cuts);
  const points = splitLongGaps(cuts);
  const spans: PlannedSpan[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    spans.push({
      startMs: points[i],
      endMs: points[i + 1],
      boundary: eventAt.get(points[i]) ?? null,
      internal: [],
      synthetic: !requested.has(points[i]),
    });
  }

  return spans;
}

/** Split a gap longer than 120s without moving an event or original boundary. */
function splitLongGaps(points: number[]): number[] {
  const out: number[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const end = points[i];
    const start = out[out.length - 1];
    const span = end - start;
    if (span <= MAX_SECTION_MS) {
      out.push(end);
      continue;
    }
    const parts = Math.ceil(span / MAX_SECTION_MS);
    const base = Math.floor(span / parts);
    let remainder = span - base * parts;
    let cursor = start;
    for (let part = 0; part < parts - 1; part++) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      cursor += base + extra;
      out.push(cursor);
    }
    out.push(end);
  }
  return out;
}

function assignInternalEvents(spans: PlannedSpan[], internal: RankedEvent[]): PlannedSpan[] {
  for (const item of internal) {
    const index = spans.findIndex((span, spanIndex) =>
      containsTime(span, item.ms, spanIndex === spans.length - 1),
    );
    const target = index >= 0 ? spans[index] : item.ms <= spans[0].startMs ? spans[0] : spans[spans.length - 1];
    target.internal.push(item);
  }
  for (const span of spans) span.internal.sort((a, b) => a.ms - b.ms);
  return spans;
}

function containsTime(span: PlannedSpan, ms: number, isLast: boolean): boolean {
  if (isLast) return ms >= span.startMs && ms <= span.endMs;
  return ms >= span.startMs && ms < span.endMs;
}

function buildAlignedSection(
  analysis: VideoAnalysis,
  spans: PlannedSpan[],
  index: number,
  primaryBoundary: RankedEvent | null,
): MusicSection {
  const span = spans[index];
  const voices = voicesForSpan(analysis.timeline ?? [], spans, index);
  const styles = stylesForVoices(voices, analysis);
  const primaryLabel = primaryBoundary?.event.label.trim() ?? '';

  if (primaryBoundary && span.endMs === primaryBoundary.ms) {
    const specific = primaryLabel ? ` (${primaryLabel})` : '';
    styles.push(`build and crescendo toward the downbeat at this section's end${specific}`);
  }
  if (span.boundary) {
    styles.push(boundaryInstruction(span.boundary, primaryBoundary));
  }
  for (const item of span.internal) {
    styles.push(internalInstruction(item));
    const description = clean(item.event.musicalDescription);
    if (description) styles.push(description);
  }

  return {
    section_name: sectionName(voices, index, span.synthetic),
    positive_local_styles: dedupe(styles),
    negative_local_styles: [],
    duration_ms: span.endMs - span.startMs,
    lines: [],
  };
}

/**
 * Each original segment is voiced by the final section that contains most of it,
 * so dropping a timeline cut does not drop that segment's musical description.
 */
function voicesForSpan(timeline: TimelineSegment[], spans: PlannedSpan[], spanIndex: number): TimelineSegment[] {
  const span = spans[spanIndex];
  const voices = timeline.filter((segment) => {
    if (overlapMs(segment, span) <= 0) return false;
    let bestIndex = 0;
    let bestAmount = -1;
    spans.forEach((candidate, index) => {
      const amount = overlapMs(segment, candidate);
      if (amount > bestAmount) {
        bestAmount = amount;
        bestIndex = index;
      }
    });
    return bestIndex === spanIndex;
  });
  voices.sort((a, b) => overlapMs(b, span) - overlapMs(a, span));
  return voices;
}

function overlapMs(segment: TimelineSegment, span: PlannedSpan): number {
  const start = Math.round(segment.startSeconds * 1000);
  const end = Math.round(segment.endSeconds * 1000);
  return Math.max(0, Math.min(end, span.endMs) - Math.max(start, span.startMs));
}

function stylesForVoices(voices: TimelineSegment[], analysis: VideoAnalysis): string[] {
  if (voices.length === 0) return [analysis.mood, `${analysis.energyLevel} energy`];
  const styles: string[] = [];
  for (const segment of voices) {
    const description = clean(segment.musicalDescription);
    if (description) styles.push(description);
    styles.push(segment.mood, `${segment.energyLevel} energy`);
    const role = segment.narrativeRole ? ROLE_HINT[segment.narrativeRole] : undefined;
    if (role) styles.push(role);
    const transition = clean(segment.transitionToNext);
    if (transition) styles.push(transition);
  }
  return styles;
}

function boundaryInstruction(boundary: RankedEvent, primaryBoundary: RankedEvent | null): string {
  const label = boundary.event.label.trim();
  const specific = label ? ` (${label})` : '';
  const isPrimary = !!primaryBoundary && boundary.event.id === primaryBoundary.event.id;
  const text = isPrimary
    ? `strong musical accent and climactic downbeat at this boundary${specific}`
    : `musical accent on the downbeat at this boundary${specific}`;
  return text.slice(0, MAX_STYLE_CHARS);
}

function internalInstruction(item: RankedEvent): string {
  const label = item.event.label.trim();
  const specific = label ? ` (${label})` : '';
  return `internal musical accent at ${formatMs(item.ms)}s${specific}`.slice(0, MAX_STYLE_CHARS);
}

function globalStyles(
  analysis: VideoAnalysis,
  durationSeconds: number,
): { positive: string[]; negative: string[] } {
  const baseline = buildCompositionPlan({
    videoPath: '',
    metadata: { filename: 'video.mp4', sizeBytes: 0, durationSeconds },
    analysis,
  });
  return {
    positive: baseline.positive_global_styles,
    negative: baseline.negative_global_styles,
  };
}

function resolveDurationMs(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return MIN_SECTION_MS;
  return Math.max(MIN_SECTION_MS, Math.round(durationSeconds * 1000));
}

function sectionName(voices: TimelineSegment[], index: number, synthetic: boolean): string {
  const base = voices[0]?.label?.trim() || `Section ${index + 1}`;
  const name = synthetic ? `${base} continued` : base;
  return name.slice(0, MAX_NAME_CHARS);
}

function clean(value?: string): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (!text || VISUAL_LEAK.test(text)) return undefined;
  return text.length > MAX_STYLE_CHARS ? text.slice(0, MAX_STYLE_CHARS) : text;
}

function dedupe(styles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const style of styles) {
    const text = style.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(0, MAX_STYLE_CHARS));
  }
  return out;
}

function uniqueSorted(points: number[]): number[] {
  return [...new Set(points)].sort((a, b) => a - b);
}

function formatMs(ms: number): string {
  const negative = ms < 0;
  const abs = Math.abs(ms);
  const whole = Math.trunc(abs / 1000);
  const frac = abs % 1000;
  const body = frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(3, '0')}`.replace(/0+$/, '');
  return negative ? `-${body}` : body;
}
