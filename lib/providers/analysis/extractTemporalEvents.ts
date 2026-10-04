import type { TimelineSegment } from '@/types';

/**
 * One absolute-time event derived from a Gemini timeline segment.
 * Action times on the segment are relative positions in [0, 1]; this type
 * stores those same instants in video seconds.
 */
export interface TemporalEvent {
  id: string;
  /** Absolute video time of actionPeakTime. */
  timeSeconds: number;
  /** Absolute video time of actionStartTime. */
  startSeconds: number;
  /** Absolute video time of actionEndTime. */
  endSeconds: number;
  label: string;
  /** sceneUnderstanding.eventSalience, unchanged. */
  salience: number;
  /** finalOutputs.eventScore, unchanged. */
  eventScore: number;
  narrativeRole?: string;
  musicalDescription?: string;
  transitionToNext?: string;
  source: 'gemini';
}

/**
 * Converts Gemini timeline segments into absolute temporal events.
 *
 * actionStartTime, actionPeakTime, and actionEndTime are relative positions
 * inside the segment, not video timestamps:
 *
 *   absoluteTime = segment.startSeconds + relativeTime * (segment.endSeconds - segment.startSeconds)
 *
 * Relative positions are clamped to [0, 1] before that conversion, so every
 * absolute timestamp stays inside the segment. Segments that are zero-length,
 * inverted, or missing the required micro-score numbers are skipped. Nothing
 * is ranked or dropped for being unimportant, and the input segments are not modified.
 */
export function extractTemporalEvents(timeline: readonly TimelineSegment[]): TemporalEvent[] {
  if (!Array.isArray(timeline)) return [];

  const events: TemporalEvent[] = [];
  for (let index = 0; index < timeline.length; index++) {
    const event = toTemporalEvent(timeline[index], index);
    if (event) events.push(event);
  }
  return events;
}

function toTemporalEvent(segment: TimelineSegment | undefined, index: number): TemporalEvent | undefined {
  if (!segment || typeof segment !== 'object') return undefined;

  const segmentStart = finiteNumber(segment.startSeconds);
  const segmentEnd = finiteNumber(segment.endSeconds);
  if (segmentStart === undefined || segmentEnd === undefined) return undefined;
  // A zero or negative span has no interior in which a relative position can land.
  if (segmentEnd <= segmentStart) return undefined;

  const segmentation = segment.microScores?.segmentation;
  const actionStart = finiteNumber(segmentation?.actionStartTime);
  const actionPeak = finiteNumber(segmentation?.actionPeakTime);
  const actionEnd = finiteNumber(segmentation?.actionEndTime);
  const salience = finiteNumber(segment.microScores?.sceneUnderstanding?.eventSalience);
  const eventScore = finiteNumber(segment.microScores?.finalOutputs?.eventScore);
  if (
    actionStart === undefined ||
    actionPeak === undefined ||
    actionEnd === undefined ||
    salience === undefined ||
    eventScore === undefined
  ) {
    return undefined;
  }

  const event: TemporalEvent = {
    id: `gemini-seg-${index + 1}`,
    timeSeconds: absoluteWithinSegment(segmentStart, segmentEnd, actionPeak),
    startSeconds: absoluteWithinSegment(segmentStart, segmentEnd, actionStart),
    endSeconds: absoluteWithinSegment(segmentStart, segmentEnd, actionEnd),
    label: typeof segment.label === 'string' && segment.label.length > 0 ? segment.label : `Segment ${index + 1}`,
    salience,
    eventScore,
    source: 'gemini',
  };

  const narrativeRole = optionalText(segment.narrativeRole);
  const musicalDescription = optionalText(segment.musicalDescription);
  const transitionToNext = optionalText(segment.transitionToNext);
  if (narrativeRole !== undefined) event.narrativeRole = narrativeRole;
  if (musicalDescription !== undefined) event.musicalDescription = musicalDescription;
  if (transitionToNext !== undefined) event.transitionToNext = transitionToNext;

  return event;
}

/** Relative Gemini positions are defined on [0, 1]. Values outside that range are pulled back in. */
function clampRelative(relative: number): number {
  return Math.min(1, Math.max(0, relative));
}

function absoluteWithinSegment(segmentStart: number, segmentEnd: number, relative: number): number {
  const span = segmentEnd - segmentStart;
  const absolute = segmentStart + clampRelative(relative) * span;
  // Snap binary floating-point dust to the nearest nanosecond, then keep
  // the result inside the segment.
  const snapped = Math.round(absolute * 1e9) / 1e9;
  return Math.min(segmentEnd, Math.max(segmentStart, snapped));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
