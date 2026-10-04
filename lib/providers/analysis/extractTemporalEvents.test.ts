import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TimelineSegment } from '@/types';
import { extractTemporalEvents } from './extractTemporalEvents.ts';

function segment(partial: {
  startSeconds: number;
  endSeconds: number;
  label?: string;
  narrativeRole?: string;
  musicalDescription?: string;
  transitionToNext?: string;
  actionStartTime?: number;
  actionPeakTime?: number;
  actionEndTime?: number;
  eventSalience?: number;
  eventScore?: number;
  omitMicroScores?: boolean;
}): TimelineSegment {
  const base = {
    startSeconds: partial.startSeconds,
    endSeconds: partial.endSeconds,
    mood: 'dramatic',
    energyLevel: 'high',
    label: partial.label ?? 'Segment',
    narrativeRole: partial.narrativeRole,
    musicalDescription: partial.musicalDescription,
    transitionToNext: partial.transitionToNext,
  } as TimelineSegment;

  if (partial.omitMicroScores) return base;

  base.microScores = {
    segmentation: {
      actionStartTime: partial.actionStartTime ?? 0,
      actionPeakTime: partial.actionPeakTime ?? 0,
      actionEndTime: partial.actionEndTime ?? 0,
    },
    sceneUnderstanding: {
      eventSalience: partial.eventSalience ?? 0,
    },
    finalOutputs: {
      eventScore: partial.eventScore ?? 0,
    },
  } as TimelineSegment['microScores'];

  return base;
}

describe('extractTemporalEvents', () => {
  it('converts the 8–16s segment peak at relative 0.14 into absolute 9.12s', () => {
    const [event] = extractTemporalEvents([
      segment({
        startSeconds: 8,
        endSeconds: 16,
        label: 'Splash',
        narrativeRole: 'climax',
        musicalDescription: 'full brass choir, fff, bold staccato fanfare',
        transitionToNext: 'sudden drop to silence',
        actionStartTime: 0.0,
        actionPeakTime: 0.14,
        actionEndTime: 0.4,
        eventSalience: 0.91,
        eventScore: 0.86,
      }),
    ]);

    assert.ok(event);
    assert.equal(event.id, 'gemini-seg-1');
    assert.equal(event.source, 'gemini');
    assert.equal(event.label, 'Splash');
    assert.equal(event.salience, 0.91);
    assert.equal(event.eventScore, 0.86);
    assert.equal(event.narrativeRole, 'climax');
    assert.equal(event.musicalDescription, 'full brass choir, fff, bold staccato fanfare');
    assert.equal(event.transitionToNext, 'sudden drop to silence');
    assert.equal(event.startSeconds, 8);
    assert.equal(event.endSeconds, 11.2);
    assert.equal(event.timeSeconds, 9.12);
    assert.ok(event.startSeconds >= 8 && event.startSeconds <= 16);
    assert.ok(event.timeSeconds >= 8 && event.timeSeconds <= 16);
    assert.ok(event.endSeconds >= 8 && event.endSeconds <= 16);
  });

  it('converts each segment from its own bounds and keeps every event', () => {
    const events = extractTemporalEvents([
      segment({
        startSeconds: 0,
        endSeconds: 3,
        label: 'Opening',
        actionStartTime: 0.1,
        actionPeakTime: 0.5,
        actionEndTime: 0.9,
        eventSalience: 0.2,
        eventScore: 0.15,
      }),
      segment({
        startSeconds: 3,
        endSeconds: 8,
        label: 'Approach',
        narrativeRole: 'rising action',
        actionStartTime: 0,
        actionPeakTime: 0.4,
        actionEndTime: 1,
        eventSalience: 0.55,
        eventScore: 0.5,
      }),
    ]);

    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((event) => event.id),
      ['gemini-seg-1', 'gemini-seg-2'],
    );
    assert.equal(events[0].timeSeconds, 1.5);
    assert.equal(events[0].startSeconds, 0.3);
    assert.equal(events[0].endSeconds, 2.7);
    assert.equal(events[0].salience, 0.2);
    assert.equal(events[1].startSeconds, 3);
    assert.equal(events[1].timeSeconds, 5);
    assert.equal(events[1].endSeconds, 8);
    assert.equal(events[1].narrativeRole, 'rising action');
    assert.equal(events[1].musicalDescription, undefined);
  });

  it('clamps relative timestamps to [0, 1] so absolutes stay inside the segment', () => {
    const [event] = extractTemporalEvents([
      segment({
        startSeconds: 10,
        endSeconds: 14,
        actionStartTime: -0.4,
        actionPeakTime: 1.8,
        actionEndTime: 0.25,
        eventSalience: 0.4,
        eventScore: 0.4,
      }),
    ]);

    assert.ok(event);
    assert.equal(event.startSeconds, 10);
    assert.equal(event.timeSeconds, 14);
    assert.equal(event.endSeconds, 11);
  });

  it('does not reorder a peak that Gemini placed before the action start', () => {
    const [event] = extractTemporalEvents([
      segment({
        startSeconds: 0,
        endSeconds: 10,
        actionStartTime: 0.8,
        actionPeakTime: 0.2,
        actionEndTime: 0.9,
        eventSalience: 0.7,
        eventScore: 0.6,
      }),
    ]);

    assert.ok(event);
    assert.equal(event.startSeconds, 8);
    assert.equal(event.timeSeconds, 2);
    assert.equal(event.endSeconds, 9);
  });

  it('skips zero-length, inverted, and incomplete segments without throwing', () => {
    const events = extractTemporalEvents([
      segment({
        startSeconds: 4,
        endSeconds: 4,
        actionPeakTime: 0.5,
        eventSalience: 1,
        eventScore: 1,
      }),
      segment({
        startSeconds: 12,
        endSeconds: 9,
        actionPeakTime: 0.5,
        eventSalience: 1,
        eventScore: 1,
      }),
      segment({
        startSeconds: 0,
        endSeconds: 5,
        omitMicroScores: true,
        eventSalience: 1,
        eventScore: 1,
      }),
      segment({
        startSeconds: Number.NaN,
        endSeconds: 5,
        actionPeakTime: 0.2,
        eventSalience: 0.5,
        eventScore: 0.5,
      }),
      segment({
        startSeconds: 2,
        endSeconds: 6,
        label: 'Kept',
        actionStartTime: 0,
        actionPeakTime: 0.5,
        actionEndTime: 1,
        eventSalience: 0.33,
        eventScore: 0.44,
      }),
    ]);

    assert.equal(events.length, 1);
    assert.equal(events[0].id, 'gemini-seg-5');
    assert.equal(events[0].label, 'Kept');
    assert.equal(events[0].timeSeconds, 4);
    assert.equal(events[0].salience, 0.33);
    assert.equal(events[0].eventScore, 0.44);
  });

  it('skips a segment when a required micro-score number is not finite', () => {
    const broken = segment({
      startSeconds: 0,
      endSeconds: 4,
      actionStartTime: 0,
      actionPeakTime: 0.5,
      actionEndTime: 1,
      eventSalience: 0.5,
      eventScore: 0.5,
    });
    const peak = broken.microScores?.segmentation;
    if (!peak) throw new Error('fixture missing segmentation');
    peak.actionPeakTime = Number.POSITIVE_INFINITY;

    assert.deepEqual(extractTemporalEvents([broken]), []);
    assert.deepEqual(extractTemporalEvents([]), []);
  });

  it('leaves the input timeline unchanged', () => {
    const timeline = [
      segment({
        startSeconds: 8,
        endSeconds: 16,
        label: 'Splash',
        actionStartTime: 0,
        actionPeakTime: 0.14,
        actionEndTime: 0.4,
        eventSalience: 0.91,
        eventScore: 0.86,
      }),
    ];
    const snapshot = structuredClone(timeline);

    extractTemporalEvents(timeline);

    assert.deepEqual(timeline, snapshot);
    assert.equal(timeline[0].microScores?.segmentation.actionPeakTime, 0.14);
    assert.equal(timeline[0].startSeconds, 8);
    assert.equal(timeline[0].endSeconds, 16);
  });
});
