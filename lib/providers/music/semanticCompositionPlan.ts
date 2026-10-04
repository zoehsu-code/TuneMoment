import type {
  AnalysisResult,
  CompositionPlan,
  MusicalIdentity,
  PrimarySyncEvent,
  SemanticCompositionPlan,
  SemanticCompositionSection,
  SyncEvent,
  SyncEventRole,
} from '@/types';
import { extractTemporalEvents } from '@/lib/providers/analysis/extractTemporalEvents';
import { buildAlignedCompositionPlan } from './buildAlignedCompositionPlan';

const MIN_SECTION_MS = 3000;
const MAX_SECTION_MS = 120_000;
const MAX_STYLE_CHARS = 100;
const MAX_NAME_CHARS = 100;
const MAX_GLOBAL_STYLES = 20;

const SYNC_ROLES: readonly SyncEventRole[] = [
  'primary_impact',
  'secondary_accent',
  'structural_transition',
  'build_start',
  'release_start',
];

const BOUNDARY_ROLES: readonly SyncEventRole[] = [
  'structural_transition',
  'build_start',
  'release_start',
];

export interface ValidationIssue {
  level: 'rejected' | 'repaired';
  message: string;
}

export interface CompositionValidation {
  status: 'ok' | 'repaired' | 'invalid';
  issues: ValidationIssue[];
  /** True when the input sections overlapped or left a gap. The returned sections do not. */
  inputOverlappedOrGapped: boolean;
  minimumDurationOk: boolean;
  totalDurationMs: number;
  /** The primary timestamp was kept exactly, as a boundary or as an internal accent. */
  primaryPreserved: boolean;
  primaryTimeSeconds: number | null;
  semantic: SemanticCompositionPlan;
  elevenLabsPlan: CompositionPlan;
}

/**
 * Reads Gemini's compositionPlan object. Unknown roles and non-numeric times are
 * omitted. This does not decide which event is musically more important.
 */
export function parseSemanticCompositionPlan(raw: unknown): SemanticCompositionPlan | null {
  const record = asRecord(raw);
  if (!record) return null;

  const identity = parseIdentity(record.musicalIdentity);
  const syncEvents = Array.isArray(record.syncEvents)
    ? record.syncEvents.flatMap((item) => {
        const event = parseSyncEvent(item);
        return event ? [event] : [];
      })
    : [];
  const sections = Array.isArray(record.sections)
    ? record.sections.flatMap((item) => {
        const section = parseSection(item);
        return section ? [section] : [];
      })
    : [];
  if (sections.length === 0 && syncEvents.length === 0 && !record.primaryEvent) return null;

  const primaryFromField = parsePrimary(record.primaryEvent);
  const primaryFromRole = syncEvents.find((event) => event.role === 'primary_impact');
  const primaryEvent = primaryFromField ?? (primaryFromRole
    ? { timeSeconds: primaryFromRole.timeSeconds, label: primaryFromRole.label, reason: primaryFromRole.reason }
    : null);

  return {
    musicalIdentity: identity,
    syncEvents,
    primaryEvent,
    positive_global_styles: stringList(record.positive_global_styles),
    negative_global_styles: stringList(record.negative_global_styles),
    sections,
  };
}

/**
 * Technical repair only. Gemini's primaryEvent time is never replaced with a
 * different timestamp. Section cuts that would sit under 3 seconds from that
 * time are dropped. Secondary events that lose a cut stay as internal accents.
 */
export function validateSemanticCompositionPlan(
  plan: SemanticCompositionPlan,
  durationSeconds: number,
): CompositionValidation {
  const source = structuredClone(plan);
  const issues: ValidationIssue[] = [];
  const durationMs = resolveDurationMs(durationSeconds);

  const primary = usablePrimary(source.primaryEvent, durationSeconds, issues);
  const syncEvents = source.syncEvents.filter((event) => {
    if (event.timeSeconds < 0 || event.timeSeconds > durationSeconds) {
      issues.push({ level: 'rejected', message: `Rejected sync event "${event.label}" at ${event.timeSeconds}s because it is outside the video.` });
      return false;
    }
    return true;
  });

  const sourceSections = source.sections.filter((section) => {
    const start = section.start_seconds;
    const end = section.end_seconds;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      issues.push({ level: 'rejected', message: `Rejected section "${section.section_name}" because its timestamps are malformed.` });
      return false;
    }
    if (section.duration_ms !== Math.round((end - start) * 1000)) {
      issues.push({ level: 'repaired', message: `Repaired duration_ms on "${section.section_name}" to match its timestamps.` });
    }
    return true;
  });

  const inputOverlappedOrGapped = hasOverlapOrGap(sourceSections, durationSeconds);
  if (inputOverlappedOrGapped) {
    issues.push({ level: 'repaired', message: 'Repaired overlapping or gapped sections into one continuous timeline.' });
  }

  const primaryMs = primary ? Math.round(primary.timeSeconds * 1000) : null;
  const primaryIsLegalBoundary = primaryMs !== null && primaryMs >= MIN_SECTION_MS && primaryMs <= durationMs - MIN_SECTION_MS;
  if (primary && primaryMs !== null && !primaryIsLegalBoundary) {
    issues.push({
      level: 'repaired',
      message: `Kept the primary event at ${formatSeconds(primary.timeSeconds)}s as an internal accent because a section boundary there would be shorter than 3000ms. The timestamp was not moved.`,
    });
  }

  const cuts = [0, durationMs];
  if (primaryIsLegalBoundary && primaryMs !== null) cuts.push(primaryMs);

  const boundaryCandidates = uniqueSorted([
    ...sourceSections.flatMap((section) => [section.start_seconds, section.end_seconds]),
    ...syncEvents
      .filter((event) => BOUNDARY_ROLES.includes(event.role))
      .map((event) => event.timeSeconds),
  ]
    .map((seconds) => Math.round(seconds * 1000))
    .filter((ms) => ms > 0 && ms < durationMs));

  for (const ms of boundaryCandidates) {
    if (ms === primaryMs) continue;
    const blocker = cuts.find((cut) => Math.abs(cut - ms) < MIN_SECTION_MS);
    if (blocker === undefined) {
      cuts.push(ms);
      continue;
    }
    const primaryBlock = primaryMs !== null && blocker === primaryMs;
    issues.push({
      level: 'repaired',
      message: primaryBlock
        ? `Dropped the section boundary at ${formatSeconds(ms / 1000)}s because it is ${Math.abs(blocker - ms)}ms from the primary event at ${formatSeconds(primaryMs / 1000)}s.`
        : `Dropped the section boundary at ${formatSeconds(ms / 1000)}s because it is ${Math.abs(blocker - ms)}ms from another cut at ${formatSeconds(blocker / 1000)}s.`,
    });
  }

  const points = splitLongGaps(uniqueSorted(cuts));
  const repairedSections = points.slice(0, -1).map((startMs, index) => {
    const endMs = points[index + 1];
    const voice = sectionWithMostOverlap(sourceSections, startMs, endMs);
    const positive = [...(voice?.positive_local_styles ?? [])];
    const negative = [...(voice?.negative_local_styles ?? [])];
    return {
      section_name: (voice?.section_name?.trim() || `Section ${index + 1}`).slice(0, MAX_NAME_CHARS),
      start_seconds: startMs / 1000,
      end_seconds: endMs / 1000,
      duration_ms: endMs - startMs,
      narrative_function: voice?.narrative_function ?? '',
      positive_local_styles: positive,
      negative_local_styles: negative,
    } satisfies SemanticCompositionSection;
  });

  const accentEvents = [...syncEvents];
  if (primary && primaryMs !== null && !points.includes(primaryMs) && !accentEvents.some((event) => Math.round(event.timeSeconds * 1000) === primaryMs)) {
    accentEvents.push({
      timeSeconds: primary.timeSeconds,
      label: primary.label || 'Primary impact',
      importance: 1,
      role: 'primary_impact',
      reason: primary.reason,
    });
  }
  for (const event of accentEvents) {
    const eventMs = Math.round(event.timeSeconds * 1000);
    if (points.includes(eventMs)) continue;
    const section = repairedSections.find((item, index) => contains(item, event.timeSeconds, index === repairedSections.length - 1));
    if (!section) continue;
    const line = internalAccent(event);
    const alreadyPresent = section.positive_local_styles.some((style) => {
      const haystack = style.toLowerCase();
      return (event.label.length > 0 && haystack.includes(event.label.toLowerCase())) || style.includes(formatSeconds(event.timeSeconds));
    });
    if (!alreadyPresent) section.positive_local_styles.push(line);
  }

  const semantic: SemanticCompositionPlan = {
    musicalIdentity: source.musicalIdentity,
    syncEvents,
    primaryEvent: primary,
    positive_global_styles: source.positive_global_styles,
    negative_global_styles: source.negative_global_styles,
    sections: repairedSections,
  };

  const elevenLabsPlan = toElevenLabsPlan(semantic);
  const totalDurationMs = elevenLabsPlan.sections.reduce((sum, section) => sum + section.duration_ms, 0);
  const minimumDurationOk = elevenLabsPlan.sections.every(
    (section) => section.duration_ms >= MIN_SECTION_MS && section.duration_ms <= MAX_SECTION_MS,
  );
  const hadPrimary = source.primaryEvent !== null;
  const primaryPreserved = !hadPrimary || (primary !== null && primaryMs !== null && (points.includes(primaryMs) || accentEvents.some((event) => Math.round(event.timeSeconds * 1000) === primaryMs)));
  let status: CompositionValidation['status'] = issues.length > 0 ? 'repaired' : 'ok';
  if (!minimumDurationOk || (hadPrimary && !primaryPreserved)) status = 'invalid';

  return {
    status,
    issues,
    inputOverlappedOrGapped,
    minimumDurationOk,
    totalDurationMs,
    primaryPreserved,
    primaryTimeSeconds: primary?.timeSeconds ?? null,
    semantic,
    elevenLabsPlan,
  };
}

/** Production plan: Gemini's plan when present, otherwise the legacy action-peak planner. */
export function compositionPlanForAnalysis(result: AnalysisResult): CompositionPlan {
  const durationSeconds = result.metadata.durationSeconds ?? 30;
  if (result.analysis.compositionPlan) {
    return validateSemanticCompositionPlan(result.analysis.compositionPlan, durationSeconds).elevenLabsPlan;
  }
  const events = extractTemporalEvents(result.analysis.timeline ?? []);
  return buildAlignedCompositionPlan(result.analysis, events, durationSeconds);
}

export function toElevenLabsMusicBody(plan: CompositionPlan): {
  model_id: 'music_v1';
  respect_sections_durations: true;
  composition_plan: CompositionPlan;
} {
  return {
    model_id: 'music_v1',
    respect_sections_durations: true,
    composition_plan: plan,
  };
}

function toElevenLabsPlan(plan: SemanticCompositionPlan): CompositionPlan {
  const identity = identityStyles(plan.musicalIdentity);
  return {
    positive_global_styles: dedupe([...identity, ...plan.positive_global_styles]).slice(0, MAX_GLOBAL_STYLES),
    negative_global_styles: dedupe(plan.negative_global_styles),
    sections: plan.sections.map((section) => ({
      section_name: section.section_name.slice(0, MAX_NAME_CHARS),
      positive_local_styles: dedupe(section.positive_local_styles),
      negative_local_styles: dedupe(section.negative_local_styles),
      duration_ms: section.duration_ms,
      lines: [],
    })),
  };
}

function identityStyles(identity: MusicalIdentity): string[] {
  return [
    identity.genre,
    Number.isFinite(identity.bpm) && identity.bpm > 0 ? `${Math.round(identity.bpm)} BPM` : '',
    identity.keyOrTonalCharacter,
    ...identity.instrumentation,
    identity.rhythmicCharacter,
    identity.harmonicCharacter,
    identity.melodicCharacter,
    identity.texture,
    identity.overallArc,
  ];
}

function internalAccent(event: SyncEvent): string {
  const role = event.role === 'primary_impact' ? 'primary impact' : event.role.replace(/_/g, ' ');
  return `${role} at ${formatSeconds(event.timeSeconds)}s (${event.label})`.slice(0, MAX_STYLE_CHARS);
}

function usablePrimary(
  primary: PrimarySyncEvent | null,
  durationSeconds: number,
  issues: ValidationIssue[],
): PrimarySyncEvent | null {
  if (!primary) return null;
  if (!Number.isFinite(primary.timeSeconds) || primary.timeSeconds < 0 || primary.timeSeconds > durationSeconds) {
    issues.push({ level: 'rejected', message: 'Rejected primaryEvent because its timestamp is malformed or outside the video. It was not replaced.' });
    return null;
  }
  return { timeSeconds: primary.timeSeconds, label: primary.label, reason: primary.reason };
}

function hasOverlapOrGap(sections: SemanticCompositionSection[], durationSeconds: number): boolean {
  if (sections.length === 0) return false;
  const ordered = [...sections].sort((a, b) => a.start_seconds - b.start_seconds);
  if (Math.abs(ordered[0].start_seconds) > 0.001) return true;
  if (Math.abs(ordered[ordered.length - 1].end_seconds - durationSeconds) > 0.001) return true;
  for (let index = 1; index < ordered.length; index++) {
    if (Math.abs(ordered[index].start_seconds - ordered[index - 1].end_seconds) > 0.001) return true;
  }
  return false;
}

function sectionWithMostOverlap(
  sections: SemanticCompositionSection[],
  startMs: number,
  endMs: number,
): SemanticCompositionSection | undefined {
  let best: SemanticCompositionSection | undefined;
  let bestOverlap = 0;
  for (const section of sections) {
    const start = Math.round(section.start_seconds * 1000);
    const end = Math.round(section.end_seconds * 1000);
    const overlap = Math.max(0, Math.min(end, endMs) - Math.max(start, startMs));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = section;
    }
  }
  return best;
}

function contains(section: SemanticCompositionSection, timeSeconds: number, isLast: boolean): boolean {
  if (isLast) return timeSeconds >= section.start_seconds && timeSeconds <= section.end_seconds + 0.0005;
  return timeSeconds >= section.start_seconds && timeSeconds < section.end_seconds;
}

function splitLongGaps(points: number[]): number[] {
  const out: number[] = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const end = points[index];
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

function parseIdentity(raw: unknown): MusicalIdentity {
  const record = asRecord(raw) ?? {};
  return {
    genre: text(record.genre),
    bpm: finite(record.bpm) ?? 0,
    keyOrTonalCharacter: text(record.keyOrTonalCharacter),
    instrumentation: stringList(record.instrumentation),
    rhythmicCharacter: text(record.rhythmicCharacter),
    harmonicCharacter: text(record.harmonicCharacter),
    melodicCharacter: text(record.melodicCharacter),
    texture: text(record.texture),
    overallArc: text(record.overallArc),
  };
}

function parseSyncEvent(raw: unknown): SyncEvent | null {
  const record = asRecord(raw);
  if (!record) return null;
  const timeSeconds = finite(record.timeSeconds);
  const role = normalizeRole(record.role);
  if (timeSeconds === null || !role) return null;
  const importance = finite(record.importance);
  return {
    timeSeconds,
    label: text(record.label) || 'Event',
    importance: importance === null ? 0 : Math.min(1, Math.max(0, importance)),
    role,
    reason: text(record.reason),
  };
}

function parsePrimary(raw: unknown): PrimarySyncEvent | null {
  if (raw === null || raw === undefined) return null;
  const record = asRecord(raw);
  if (!record) return null;
  const timeSeconds = finite(record.timeSeconds);
  if (timeSeconds === null) return null;
  return { timeSeconds, label: text(record.label), reason: text(record.reason) };
}

function parseSection(raw: unknown): SemanticCompositionSection | null {
  const record = asRecord(raw);
  if (!record) return null;
  const start = finite(record.start_seconds);
  const end = finite(record.end_seconds);
  if (start === null || end === null) return null;
  const duration = finite(record.duration_ms);
  return {
    section_name: text(record.section_name) || 'Section',
    start_seconds: start,
    end_seconds: end,
    duration_ms: duration === null ? Math.round((end - start) * 1000) : Math.round(duration),
    narrative_function: text(record.narrative_function),
    positive_local_styles: stringList(record.positive_local_styles),
    negative_local_styles: stringList(record.negative_local_styles),
  };
}

function normalizeRole(raw: unknown): SyncEventRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SYNC_ROLES.find((role) => role === normalized) ?? null;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function text(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function finite(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function resolveDurationMs(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return MIN_SECTION_MS;
  return Math.max(MIN_SECTION_MS, Math.round(durationSeconds * 1000));
}

function uniqueSorted(points: number[]): number[] {
  return [...new Set(points)].sort((a, b) => a - b);
}

function dedupe(styles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const style of styles) {
    const value = style.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0, MAX_STYLE_CHARS));
  }
  return out;
}

function formatSeconds(seconds: number): string {
  return (Math.round(seconds * 1000) / 1000).toFixed(3);
}
