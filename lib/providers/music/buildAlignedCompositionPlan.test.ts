import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CompositionPlan, TimelineSegment, VideoAnalysis } from '@/types';
import type { TemporalEvent } from '@/lib/providers/analysis/extractTemporalEvents';
import { buildAlignedCompositionPlan } from './buildAlignedCompositionPlan.ts';

const BRASS = 'full brass choir, fff, bold staccato fanfare with driving timpani';
const GUITAR = 'muted electric guitar, mp, tense and pulsing';
const APPROACH = 'muted electric guitar, mp, tense and pulsing';
const LAUNCH = 'layered synth ostinato and electric bass, mf, accelerating build';
const AFTERMATH = 'full brass choir and timpani, fff, bold staccato hit then a long release';

function timeline(): TimelineSegment[] {
  return [
    {
      startSeconds: 0,
      endSeconds: 8,
      mood: 'suspenseful',
      energyLevel: 'medium',
      label: 'Approach',
      narrativeRole: 'rising action',
      musicalDescription: GUITAR,
      transitionToNext: 'snare crescendo into a hard stop',
    },
    {
      startSeconds: 8,
      endSeconds: 16,
      mood: 'dramatic',
      energyLevel: 'high',
      label: 'Impact',
      narrativeRole: 'climax',
      musicalDescription: BRASS,
      transitionToNext: 'sudden drop to silence',
    },
  ];
}

function progressionTimeline(): TimelineSegment[] {
  return [
    {
      startSeconds: 0,
      endSeconds: 3,
      mood: 'suspenseful',
      energyLevel: 'low',
      label: 'Approach',
      narrativeRole: 'intro',
      musicalDescription: APPROACH,
      transitionToNext: 'a quiet pickup into motion',
    },
    {
      startSeconds: 3,
      endSeconds: 8,
      mood: 'energetic',
      energyLevel: 'medium',
      label: 'Ramp Launch',
      narrativeRole: 'rising action',
      musicalDescription: LAUNCH,
      transitionToNext: 'crescendo into the downbeat',
    },
    {
      startSeconds: 8,
      endSeconds: 16,
      mood: 'dramatic',
      energyLevel: 'high',
      label: 'Splash Aftermath',
      narrativeRole: 'climax',
      musicalDescription: AFTERMATH,
      transitionToNext: 'release into open sustain',
    },
  ];
}

function analysis(overrides?: Partial<VideoAnalysis>): VideoAnalysis {
  return {
    mood: 'dramatic',
    energyLevel: 'high',
    pace: 'moderate',
    bpm: 110,
    genre: 'indie',
    sceneCount: 2,
    motionScore: 0.7,
    instrumentSuggestions: ['nylon-string guitar', 'electric bass'],
    analysisSummary: 'A tense approach that breaks into one hard accent.',
    musicalRecommendation: 'warm electric guitar and soft drums, building gently',
    keyMode: 'minor',
    rhythmicFeel: 'syncopated off-beat accents',
    dynamicArc: 'mp build to fff hit',
    sonicTexture: 'dry close-miked kit with roomy guitar',
    timeline: timeline(),
    ...overrides,
  };
}

function event(partial: Partial<TemporalEvent> & Pick<TemporalEvent, 'id' | 'timeSeconds'>): TemporalEvent {
  return {
    startSeconds: partial.timeSeconds,
    endSeconds: partial.timeSeconds,
    label: 'Event',
    salience: 0.5,
    eventScore: 0.5,
    source: 'gemini',
    ...partial,
  };
}

function cuts(plan: CompositionPlan): number[] {
  const points = [0];
  for (const section of plan.sections) points.push(points[points.length - 1] + section.duration_ms);
  return points;
}

function styles(plan: CompositionPlan, index: number): string {
  return plan.sections[index].positive_local_styles.join(' | ');
}

function assertValid(plan: CompositionPlan, durationSeconds: number): void {
  const expected = Math.max(3000, Math.round(durationSeconds * 1000));
  let sum = 0;
  assert.ok(plan.sections.length >= 1);
  for (const section of plan.sections) {
    assert.ok(section.duration_ms >= 3000, `${section.section_name} is ${section.duration_ms}ms`);
    assert.ok(section.duration_ms <= 120000, `${section.section_name} is ${section.duration_ms}ms`);
    assert.ok(section.section_name.length >= 1 && section.section_name.length <= 100);
    assert.deepEqual(section.lines, []);
    for (const style of [...section.positive_local_styles, ...section.negative_local_styles]) {
      assert.ok(style.length <= 100, style);
    }
    sum += section.duration_ms;
  }
  assert.equal(sum, expected);
}

describe('buildAlignedCompositionPlan', () => {
  it('preserves a compatible original boundary and drops only the one that conflicts with 9.12s', () => {
    const source = analysis({ timeline: progressionTimeline() });
    const events = [
      event({
        id: 'peak',
        timeSeconds: 9.12,
        label: 'Water Impact',
        salience: 0.95,
        eventScore: 0.93,
      }),
    ];

    const plan = buildAlignedCompositionPlan(source, events, 16);

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 3000, 9120, 16000]);
    assert.equal(plan.sections[0].duration_ms, 3000);
    assert.equal(plan.sections[1].duration_ms, 6120);
    assert.equal(plan.sections[2].duration_ms, 6880);
    assert.equal(
      plan.sections.reduce((sum, section) => sum + section.duration_ms, 0),
      16000,
    );
  });

  it('preserves every original boundary that stays at least 3 seconds from the event', () => {
    const source = analysis({
      timeline: [
        { startSeconds: 0, endSeconds: 4, mood: 'calm', energyLevel: 'low', label: 'A' },
        { startSeconds: 4, endSeconds: 8, mood: 'emotional', energyLevel: 'medium', label: 'B' },
        { startSeconds: 8, endSeconds: 12, mood: 'energetic', energyLevel: 'high', label: 'C' },
        { startSeconds: 12, endSeconds: 20, mood: 'dramatic', energyLevel: 'high', label: 'D' },
      ],
    });
    const plan = buildAlignedCompositionPlan(
      source,
      [event({ id: 'peak', timeSeconds: 15.5, label: 'Arrival', salience: 0.9, eventScore: 0.9 })],
      20,
    );

    assertValid(plan, 20);
    assert.deepEqual(cuts(plan), [0, 4000, 8000, 12000, 15500, 20000]);
  });

  it('keeps the higher-priority event as the boundary and the nearer event as an internal accent', () => {
    const plan = buildAlignedCompositionPlan(
      analysis({ timeline: progressionTimeline() }),
      [
        event({
          id: 'early',
          timeSeconds: 6.3,
          label: 'Lead-in',
          salience: 0.7,
          eventScore: 0.7,
          musicalDescription: 'a soft woodblock pickup',
        }),
        event({
          id: 'peak',
          timeSeconds: 9.12,
          label: 'Water Impact',
          salience: 0.94,
          eventScore: 0.94,
        }),
      ],
      16,
    );

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 3000, 9120, 16000]);
    assert.equal(cuts(plan).includes(6300), false);
    const launch = styles(plan, 1);
    assert.match(launch, /internal musical accent at 6\.3s \(Lead-in\)/);
    assert.match(launch, /a soft woodblock pickup/);
    assert.match(styles(plan, 2), /climactic downbeat at this boundary \(Water Impact\)/);
    assert.doesNotMatch(styles(plan, 2), /Lead-in/);
    assert.doesNotMatch(styles(plan, 0), /Lead-in/);
  });

  it('does not open a section on an event less than 3 seconds from the start', () => {
    const plan = buildAlignedCompositionPlan(
      analysis({ timeline: progressionTimeline() }),
      [event({ id: 'early', timeSeconds: 1.25, label: 'Early', salience: 0.99, eventScore: 0.99 })],
      16,
    );

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 3000, 8000, 16000]);
    assert.equal(cuts(plan).includes(1250), false);
    assert.match(styles(plan, 0), /internal musical accent at 1\.25s \(Early\)/);
    assert.doesNotMatch(styles(plan, 1), /Early/);
    assert.ok(plan.sections.every((section) => section.duration_ms >= 3000));
  });

  it('does not close a section on an event less than 3 seconds from the end', () => {
    const plan = buildAlignedCompositionPlan(
      analysis({ timeline: progressionTimeline() }),
      [event({ id: 'late', timeSeconds: 14.8, label: 'Late', salience: 0.99, eventScore: 0.99 })],
      16,
    );

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 3000, 8000, 16000]);
    assert.equal(cuts(plan).includes(14800), false);
    assert.match(styles(plan, 2), /internal musical accent at 14\.8s \(Late\)/);
    assert.doesNotMatch(styles(plan, 1), /Late/);
    assert.ok(plan.sections[plan.sections.length - 1].duration_ms >= 3000);
  });

  it('preserves the original timeline when there are no visual events', () => {
    const plan = buildAlignedCompositionPlan(analysis({ timeline: progressionTimeline() }), [], 16);

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 3000, 8000, 16000]);
    assert.match(styles(plan, 0), new RegExp(APPROACH));
    assert.match(styles(plan, 1), new RegExp(LAUNCH));
    assert.match(styles(plan, 2), new RegExp(AFTERMATH));
    assert.equal(plan.sections[0].section_name, 'Approach');
    assert.equal(plan.sections[1].section_name, 'Ramp Launch');
    assert.equal(plan.sections[2].section_name, 'Splash Aftermath');
  });

  it('keeps musical progression from both sides of a removed original boundary', () => {
    const plan = buildAlignedCompositionPlan(
      analysis({ timeline: progressionTimeline() }),
      [
        event({
          id: 'peak',
          timeSeconds: 9.12,
          label: 'Water Impact',
          salience: 0.95,
          eventScore: 0.93,
        }),
      ],
      16,
    );

    assert.deepEqual(cuts(plan), [0, 3000, 9120, 16000]);
    assert.equal(plan.sections[0].section_name, 'Approach');
    assert.equal(plan.sections[1].section_name, 'Ramp Launch');
    assert.equal(plan.sections[2].section_name, 'Splash Aftermath');

    const approach = styles(plan, 0);
    assert.match(approach, new RegExp(APPROACH));
    assert.match(approach, /gentle introduction/);
    assert.match(approach, /low energy/);
    assert.doesNotMatch(approach, new RegExp(LAUNCH));
    assert.doesNotMatch(approach, new RegExp(AFTERMATH));
    assert.doesNotMatch(approach, /build and crescendo toward the downbeat/);

    const launch = styles(plan, 1);
    assert.match(launch, new RegExp(LAUNCH));
    assert.match(launch, /building intensity/);
    assert.match(launch, /medium energy/);
    assert.match(launch, /crescendo into the downbeat/);
    assert.match(launch, /build and crescendo toward the downbeat at this section's end \(Water Impact\)/);
    assert.doesNotMatch(launch, new RegExp(APPROACH));
    assert.doesNotMatch(launch, new RegExp(AFTERMATH));
    assert.doesNotMatch(launch, /climactic downbeat at this boundary/);

    const aftermath = styles(plan, 2);
    assert.match(aftermath, new RegExp(AFTERMATH));
    assert.match(aftermath, /full arrangement, climactic peak/);
    assert.match(aftermath, /high energy/);
    assert.match(aftermath, /release into open sustain/);
    assert.match(aftermath, /strong musical accent and climactic downbeat at this boundary \(Water Impact\)/);
    assert.doesNotMatch(aftermath, new RegExp(LAUNCH));
    assert.doesNotMatch(aftermath, new RegExp(APPROACH));
  });

  it('holds duration, exactness, and immutability invariants for every plan', () => {
    const scenarios: { duration: number; source: VideoAnalysis; events: TemporalEvent[]; cuts: number[] }[] = [
      {
        duration: 16,
        source: analysis({ timeline: progressionTimeline() }),
        events: [event({ id: 'peak', timeSeconds: 9.12, label: 'Water Impact', salience: 0.95, eventScore: 0.93 })],
        cuts: [0, 3000, 9120, 16000],
      },
      {
        duration: 20,
        source: analysis({
          timeline: [
            { startSeconds: 0, endSeconds: 4, mood: 'calm', energyLevel: 'low', label: 'A' },
            { startSeconds: 4, endSeconds: 8, mood: 'emotional', energyLevel: 'medium', label: 'B' },
            { startSeconds: 8, endSeconds: 12, mood: 'energetic', energyLevel: 'high', label: 'C' },
            { startSeconds: 12, endSeconds: 20, mood: 'dramatic', energyLevel: 'high', label: 'D' },
          ],
        }),
        events: [event({ id: 'peak', timeSeconds: 15.5, label: 'Arrival', salience: 0.9, eventScore: 0.9 })],
        cuts: [0, 4000, 8000, 12000, 15500, 20000],
      },
      {
        duration: 16,
        source: analysis({ timeline: progressionTimeline() }),
        events: [
          event({ id: 'early', timeSeconds: 6.3, label: 'Lead-in', salience: 0.7, eventScore: 0.7 }),
          event({ id: 'peak', timeSeconds: 9.12, label: 'Water Impact', salience: 0.94, eventScore: 0.94 }),
        ],
        cuts: [0, 3000, 9120, 16000],
      },
      {
        duration: 16,
        source: analysis({ timeline: progressionTimeline() }),
        events: [event({ id: 'early', timeSeconds: 1.25, label: 'Early', salience: 0.99, eventScore: 0.99 })],
        cuts: [0, 3000, 8000, 16000],
      },
      {
        duration: 16,
        source: analysis({ timeline: progressionTimeline() }),
        events: [event({ id: 'late', timeSeconds: 14.8, label: 'Late', salience: 0.99, eventScore: 0.99 })],
        cuts: [0, 3000, 8000, 16000],
      },
      {
        duration: 16,
        source: analysis({ timeline: progressionTimeline() }),
        events: [],
        cuts: [0, 3000, 8000, 16000],
      },
      {
        duration: 16.4,
        source: analysis(),
        events: [event({ id: 'peak', timeSeconds: 9.12, label: 'Impact', salience: 0.9, eventScore: 0.9 })],
        cuts: [0, 9120, 16400],
      },
      {
        duration: 150,
        source: analysis(),
        events: [],
        cuts: [],
      },
    ];

    for (const scenario of scenarios) {
      const snapshot = structuredClone({ source: scenario.source, events: scenario.events });
      const plan = buildAlignedCompositionPlan(scenario.source, scenario.events, scenario.duration);
      assertValid(plan, scenario.duration);
      if (scenario.cuts.length > 0) assert.deepEqual(cuts(plan), scenario.cuts);
      for (const item of scenario.events) {
        const ms = Math.round(item.timeSeconds * 1000);
        if (cuts(plan).includes(ms)) assert.equal(cuts(plan).includes(ms), true);
      }
      assert.deepEqual({ source: scenario.source, events: scenario.events }, snapshot);
    }
  });

  it('places one primary event on a boundary at exactly 9.12s when the nearby original cut conflicts', () => {
    const source = analysis();
    const events = [
      event({
        id: 'peak',
        timeSeconds: 9.12,
        label: 'Impact',
        salience: 0.95,
        eventScore: 0.89,
        narrativeRole: 'climax',
        musicalDescription: BRASS,
      }),
    ];
    const snapshot = structuredClone({ source, events });

    const plan = buildAlignedCompositionPlan(source, events, 16);

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 9120, 16000]);
    const hit = styles(plan, 1);
    assert.match(hit, /strong musical accent and climactic downbeat at this boundary \(Impact\)/);
    assert.match(hit, new RegExp(BRASS));
    assert.doesNotMatch(styles(plan, 0), /climactic downbeat at this boundary/);
    assert.match(styles(plan, 0), new RegExp(GUITAR));
    assert.deepEqual({ source, events }, snapshot);
  });

  it('keeps two boundaries when the events are at least 3 seconds apart', () => {
    const plan = buildAlignedCompositionPlan(
      analysis(),
      [
        event({ id: 'a', timeSeconds: 4, label: 'First', salience: 0.7, eventScore: 0.7 }),
        event({ id: 'b', timeSeconds: 7, label: 'Second', salience: 0.8, eventScore: 0.8 }),
      ],
      16,
    );

    assertValid(plan, 16);
    assert.deepEqual(cuts(plan), [0, 4000, 7000, 16000]);
    assert.match(styles(plan, 1), /First/);
    assert.match(styles(plan, 2), /Second/);
  });

  it('returns a valid plan when there are no events and the video is shorter than the timeline', () => {
    const plan = buildAlignedCompositionPlan(analysis(), [], 12.5);

    assertValid(plan, 12.5);
    assert.deepEqual(cuts(plan), [0, 8000, 12500]);
    assert.ok(plan.positive_global_styles.includes('110 BPM'));
  });

  it('keeps every section between 3000ms and 120000ms and preserves a fractional duration exactly', () => {
    const plan = buildAlignedCompositionPlan(
      analysis(),
      [event({ id: 'peak', timeSeconds: 9.12, label: 'Impact', salience: 0.9, eventScore: 0.9 })],
      16.4,
    );

    assertValid(plan, 16.4);
    assert.deepEqual(cuts(plan), [0, 9120, 16400]);
    for (const section of plan.sections) assert.ok(section.duration_ms >= 3000);
    assert.equal(
      plan.sections.reduce((sum, section) => sum + section.duration_ms, 0),
      16400,
    );

    const long = buildAlignedCompositionPlan(analysis(), [], 150);
    assertValid(long, 150);
    assert.equal(
      long.sections.reduce((sum, section) => sum + section.duration_ms, 0),
      150000,
    );
    for (const section of long.sections) {
      assert.ok(section.duration_ms >= 3000);
      assert.ok(section.duration_ms <= 120000);
    }
  });

  it('keeps the existing musical description, instrumentation, key, and rhythm in the plan', () => {
    const plan = buildAlignedCompositionPlan(
      analysis(),
      [event({ id: 'peak', timeSeconds: 9.12, label: 'Impact', salience: 0.95, eventScore: 0.89 })],
      16,
    );

    assert.ok(plan.positive_global_styles.includes('indie'));
    assert.ok(plan.positive_global_styles.includes('110 BPM'));
    assert.ok(plan.positive_global_styles.includes('minor key'));
    assert.ok(plan.positive_global_styles.includes('nylon-string guitar'));
    assert.ok(plan.positive_global_styles.includes('syncopated off-beat accents'));
    assert.ok(plan.positive_global_styles.includes('mp build to fff hit'));
    assert.match(styles(plan, 1), new RegExp(BRASS));
    assert.match(styles(plan, 0), /snare crescendo into a hard stop/);
  });
});
