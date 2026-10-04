import type { AnalysisResult, CompositionPlan, TimelineSegment } from '@/types';
import {
  extractTemporalEvents,
  type TemporalEvent,
} from '@/lib/providers/analysis/extractTemporalEvents';
import { buildAlignedCompositionPlan } from '@/lib/providers/music/buildAlignedCompositionPlan';

export const DRY_RUN_COMPLETE_LINE =
  'DRY RUN COMPLETE — no Gemini or ElevenLabs API calls were made.';

const MIN_SECTION_MS = 3000;

export interface SemanticBoundaryCandidate {
  timeSeconds: number;
  previous: TimelineSegment;
  next: TimelineSegment;
  previousSalience?: number;
  previousEventScore?: number;
  nextSalience?: number;
  nextEventScore?: number;
}

export type TemporalCandidate =
  | { timeSeconds: number; type: 'action_peak'; event: TemporalEvent }
  | { timeSeconds: number; type: 'semantic_boundary'; boundary: SemanticBoundaryCandidate };

/**
 * Boundaries between adjacent Gemini segments. These are semantic cuts from the
 * analysis timeline. They are not ranked, and they are not treated as musical hits.
 */
export function semanticBoundaryCandidates(
  timeline: readonly TimelineSegment[],
): SemanticBoundaryCandidate[] {
  const boundaries: SemanticBoundaryCandidate[] = [];
  for (let index = 0; index < timeline.length - 1; index++) {
    const previous = timeline[index];
    const next = timeline[index + 1];
    boundaries.push({
      timeSeconds: previous.endSeconds,
      previous,
      next,
      previousSalience: finiteScore(previous.microScores?.sceneUnderstanding?.eventSalience),
      previousEventScore: finiteScore(previous.microScores?.finalOutputs?.eventScore),
      nextSalience: finiteScore(next.microScores?.sceneUnderstanding?.eventSalience),
      nextEventScore: finiteScore(next.microScores?.finalOutputs?.eventScore),
    });
  }
  return boundaries;
}

/** Action peaks from the production extractor, plus semantic boundaries, in time order. */
export function temporalCandidates(
  timeline: readonly TimelineSegment[],
  events: readonly TemporalEvent[],
): TemporalCandidate[] {
  const candidates: TemporalCandidate[] = [
    ...events.map((event) => ({ timeSeconds: event.timeSeconds, type: 'action_peak' as const, event })),
    ...semanticBoundaryCandidates(timeline).map((boundary) => ({
      timeSeconds: boundary.timeSeconds,
      type: 'semantic_boundary' as const,
      boundary,
    })),
  ];
  candidates.sort((a, b) => a.timeSeconds - b.timeSeconds || a.type.localeCompare(b.type));
  return candidates;
}

/**
 * Readable report for one saved analysis. Uses the production extractor and the
 * production aligned planner. Does not call Gemini or ElevenLabs.
 */
export function buildTimelineDebugReport(result: AnalysisResult, durationSeconds: number): string {
  const timeline = result.analysis.timeline;
  const events = extractTemporalEvents(timeline);
  const boundaries = semanticBoundaryCandidates(timeline);
  const candidates = temporalCandidates(timeline, events);
  const plan = buildAlignedCompositionPlan(result.analysis, events, durationSeconds);

  const sections = [
    '=== ORIGINAL GEMINI TIMELINE ===',
    '',
    formatTimeline(timeline),
    '',
    '=== ACTION-PEAK EVENTS ===',
    '',
    formatActionPeaks(events),
    '',
    '=== SEMANTIC BOUNDARY CANDIDATES ===',
    '',
    formatSemanticBoundaries(boundaries),
    '',
    '=== TEMPORAL CANDIDATES ===',
    '',
    formatCandidateTable(candidates),
    '',
    '=== CURRENT PLANNER RESULT ===',
    '',
    formatPlannerResult(timeline, events, plan, durationSeconds),
    '',
    '=== ELEVENLABS COMPOSITION PLAN — DRY RUN ONLY ===',
    '',
    JSON.stringify(elevenLabsRequestBody(plan), null, 2),
    '',
    '=== GENERATION PATH ===',
    '',
    result.analysis.compositionPlan
      ? 'This analysis includes a Gemini compositionPlan. Production validates that plan and does not let action peaks replace its primary event.'
      : 'This fixture has no compositionPlan. The planner result above is the legacy action-peak planner, for comparison only. Production uses a Gemini compositionPlan when one is present.',
    '',
    DRY_RUN_COMPLETE_LINE,
  ];
  return sections.join('\n');
}

function formatTimeline(timeline: readonly TimelineSegment[]): string {
  return timeline
    .map((segment) => {
      const lines = [
        `${seconds(segment.startSeconds)}–${seconds(segment.endSeconds)}`,
        segment.label,
        `role: ${segment.narrativeRole ?? '(none)'}`,
        `mood: ${segment.mood}`,
        `energy: ${segment.energyLevel}`,
      ];
      if (segment.musicalDescription) lines.push(`musical: ${segment.musicalDescription}`);
      if (segment.transitionToNext) lines.push(`transition: ${segment.transitionToNext}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatActionPeaks(events: readonly TemporalEvent[]): string {
  if (events.length === 0) return '(none)';
  return events
    .map((event) =>
      [
        `${seconds(event.timeSeconds)}s`,
        event.label,
        `salience: ${score(event.salience)}`,
        `eventScore: ${score(event.eventScore)}`,
        `priority: ${priorityText(event)}`,
        `actionStart: ${seconds(event.startSeconds)}s`,
        `actionEnd: ${seconds(event.endSeconds)}s`,
        `role: ${event.narrativeRole ?? '(none)'}`,
        event.musicalDescription ? `musical: ${event.musicalDescription}` : '',
        event.transitionToNext ? `transition: ${event.transitionToNext}` : '',
      ]
        .filter((line) => line.length > 0)
        .join('\n'),
    )
    .join('\n\n');
}

function formatSemanticBoundaries(boundaries: readonly SemanticBoundaryCandidate[]): string {
  if (boundaries.length === 0) return '(none)';
  return boundaries
    .map((boundary) => {
      const lines = [
        `${seconds(boundary.timeSeconds)}s`,
        boundary.previous.label,
        `→ ${boundary.next.label}`,
        `${boundary.previous.narrativeRole ?? '(none)'} → ${boundary.next.narrativeRole ?? '(none)'}`,
        `${boundary.previous.mood}/${boundary.previous.energyLevel} → ${boundary.next.mood}/${boundary.next.energyLevel}`,
        `previous salience: ${formatOptionalScore(boundary.previousSalience)}`,
        `previous eventScore: ${formatOptionalScore(boundary.previousEventScore)}`,
        `next salience: ${formatOptionalScore(boundary.nextSalience)}`,
        `next eventScore: ${formatOptionalScore(boundary.nextEventScore)}`,
        `transition: ${boundary.previous.transitionToNext ?? '(none)'}`,
      ];
      if (Math.abs(boundary.previous.endSeconds - boundary.next.startSeconds) > 0.0005) {
        lines.push(`next segment starts at ${seconds(boundary.next.startSeconds)}s`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatCandidateTable(candidates: readonly TemporalCandidate[]): string {
  const header = `${'time'.padEnd(8)} ${'type'.padEnd(19)} label`;
  const rows = candidates.map((candidate) => {
    const label =
      candidate.type === 'action_peak'
        ? candidate.event.label
        : `${candidate.boundary.previous.narrativeRole ?? '(none)'} → ${candidate.boundary.next.narrativeRole ?? '(none)'}`;
    return `${seconds(candidate.timeSeconds).padEnd(8)} ${candidate.type.padEnd(19)} ${label}`;
  });
  const details = candidates.map((candidate) => {
    if (candidate.type === 'action_peak') {
      const event = candidate.event;
      return [
        `${seconds(event.timeSeconds)}  action_peak`,
        `  label: ${event.label}`,
        `  salience: ${score(event.salience)}  eventScore: ${score(event.eventScore)}  priority: ${priorityText(event)}`,
        `  actionStart: ${seconds(event.startSeconds)}s  actionEnd: ${seconds(event.endSeconds)}s`,
        `  role: ${event.narrativeRole ?? '(none)'}`,
      ].join('\n');
    }
    const boundary = candidate.boundary;
    return [
      `${seconds(boundary.timeSeconds)}  semantic_boundary`,
      `  ${boundary.previous.label} → ${boundary.next.label}`,
      `  role: ${boundary.previous.narrativeRole ?? '(none)'} → ${boundary.next.narrativeRole ?? '(none)'}`,
      `  mood/energy: ${boundary.previous.mood}/${boundary.previous.energyLevel} → ${boundary.next.mood}/${boundary.next.energyLevel}`,
      `  previous salience: ${formatOptionalScore(boundary.previousSalience)}  previous eventScore: ${formatOptionalScore(boundary.previousEventScore)}`,
      `  transition: ${boundary.previous.transitionToNext ?? '(none)'}`,
    ].join('\n');
  });
  return [header, ...rows, '', ...details].join('\n');
}

function formatPlannerResult(
  timeline: readonly TimelineSegment[],
  events: readonly TemporalEvent[],
  plan: CompositionPlan,
  durationSeconds: number,
): string {
  const cuts = sectionCuts(plan);
  const durationMs = cuts[cuts.length - 1] ?? 0;
  const accepted = events.filter((event) => cuts.includes(Math.round(event.timeSeconds * 1000)));
  const originalMs = originalBoundaryMs(timeline, durationMs);
  const keptOriginal = originalMs.filter((ms) => cuts.includes(ms));
  const droppedOriginal = originalMs.filter((ms) => !cuts.includes(ms));
  const ranked = [...events].sort((a, b) => {
    const priorityGap = eventPriority(b) - eventPriority(a);
    if (priorityGap !== 0) return priorityGap;
    if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
    return a.id.localeCompare(b.id);
  });

  const originalLines = [
    ...keptOriginal.map((ms) => `- ${seconds(ms / 1000)}s kept`),
    ...droppedOriginal.map((ms) => `- ${seconds(ms / 1000)}s not kept — ${rejectionReason(ms, durationMs, accepted)}`),
  ];
  if (originalLines.length === 0) originalLines.push('(none)');

  return [
    'Action peaks ranked by the production priority (salience + eventScore) / 2.',
    'A peak is a structural boundary only when the current planner placed that exact timestamp on a section cut.',
    '',
    'Ranked action peaks:',
    ...ranked.map((event, index) => {
      const ms = Math.round(event.timeSeconds * 1000);
      const status = cuts.includes(ms) ? 'accepted structural boundary' : `not a boundary — ${rejectionReason(ms, durationMs, accepted)}`;
      return `${index + 1}. ${seconds(event.timeSeconds)}s  ${event.label}  priority ${priorityText(event)}  — ${status}`;
    }),
    '',
    'Accepted events:',
    accepted.length === 0
      ? '(none)'
      : accepted
          .map((event) => `- ${seconds(event.timeSeconds)}s  ${event.label}  priority ${priorityText(event)}`)
          .join('\n'),
    '',
    'Original Gemini boundaries:',
    ...originalLines,
    '',
    'Final boundaries:',
    cuts.map((ms) => seconds(ms / 1000)).join(' → '),
    '',
    'Section durations:',
    ...plan.sections.map((section, index) => {
      const start = cuts[index] ?? 0;
      const end = start + section.duration_ms;
      return `${seconds(start / 1000)}–${seconds(end / 1000)}  ${section.duration_ms}ms  ${section.section_name}`;
    }),
    '',
    `Video duration: ${seconds(durationSeconds)}s (${durationMs}ms)`,
  ].join('\n');
}

function rejectionReason(ms: number, durationMs: number, accepted: readonly TemporalEvent[]): string {
  if (ms < MIN_SECTION_MS) return `${ms}ms is under 3000ms from the start`;
  if (ms > durationMs - MIN_SECTION_MS) return `${durationMs - ms}ms is under 3000ms from the end`;
  const conflicts = accepted
    .map((event) => ({
      event,
      distance: Math.abs(Math.round(event.timeSeconds * 1000) - ms),
    }))
    .filter((item) => item.distance < MIN_SECTION_MS)
    .sort((a, b) => a.event.timeSeconds - b.event.timeSeconds);
  if (conflicts.length === 0) return 'not present on a section cut';
  return conflicts
    .map((item) => `${item.distance}ms from the accepted action peak at ${seconds(item.event.timeSeconds)}s`)
    .join('; ');
}

function originalBoundaryMs(timeline: readonly TimelineSegment[], durationMs: number): number[] {
  const points = new Set<number>();
  for (let index = 0; index < timeline.length - 1; index++) {
    const ms = Math.round(timeline[index].endSeconds * 1000);
    if (ms > 0 && ms < durationMs) points.add(ms);
  }
  return [...points].sort((a, b) => a - b);
}

function sectionCuts(plan: CompositionPlan): number[] {
  const cuts = [0];
  for (const section of plan.sections) cuts.push(cuts[cuts.length - 1] + section.duration_ms);
  return cuts;
}

/** Request body ElevenMusicProvider posts to /v1/music. This report does not send it. */
function elevenLabsRequestBody(plan: CompositionPlan): {
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

function eventPriority(event: TemporalEvent): number {
  return (event.salience + event.eventScore) / 2;
}

function seconds(value: number): string {
  return value.toFixed(3);
}

function score(value: number): string {
  return value.toFixed(2);
}

function priorityText(event: TemporalEvent): string {
  return eventPriority(event).toFixed(3);
}

function formatOptionalScore(value: number | undefined): string {
  return value === undefined ? '(none)' : score(value);
}

function finiteScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
