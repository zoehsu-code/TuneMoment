import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SemanticCompositionPlan, SemanticCompositionSection, SyncEvent } from '@/types';
import { buildAnalysisPrompt } from '@/lib/providers/analysis/GeminiAnalyzer';
import { skateboardAnalysis, SKATEBOARD_DURATION_SECONDS } from '@/lib/debug/skateboardAnalysis';
import {
  compositionPlanForAnalysis,
  parseSemanticCompositionPlan,
  toElevenLabsMusicBody,
  validateSemanticCompositionPlan,
} from './semanticCompositionPlan.ts';

const GUITAR = 'muted distorted guitar eighth notes with tight closed hi-hat and restrained bass';
const BUILD = 'fast distorted power chords and pounding drums, rising toward the primary impact';
const RELEASE = 'open distorted guitar chords, ringing cymbal sustain, reduced rhythmic density, triumphant release';

function section(
  start: number,
  end: number,
  name: string,
  positive: string[],
  negative: string[] = [],
  narrative = '',
): SemanticCompositionSection {
  return {
    section_name: name,
    start_seconds: start,
    end_seconds: end,
    duration_ms: Math.round((end - start) * 1000),
    narrative_function: narrative,
    positive_local_styles: positive,
    negative_local_styles: negative,
  };
}

function event(partial: Partial<SyncEvent> & Pick<SyncEvent, 'timeSeconds' | 'role'>): SyncEvent {
  return {
    label: 'Event',
    importance: 0.5,
    reason: '',
    ...partial,
  };
}

function plan(overrides: Partial<SemanticCompositionPlan> = {}): SemanticCompositionPlan {
  return {
    musicalIdentity: {
      genre: 'punk',
      bpm: 135,
      keyOrTonalCharacter: 'minor',
      instrumentation: ['distorted electric guitar', 'electric bass', 'acoustic drums'],
      rhythmicCharacter: 'driving eighth-note guitar with a tight acoustic kit',
      harmonicCharacter: 'power chords',
      melodicCharacter: 'short vocal-less guitar figures',
      texture: 'dry close-miked kit and mid-gain guitars',
      overallArc: 'anticipation, a continuous build, one impact, then release',
    },
    syncEvents: [],
    primaryEvent: null,
    positive_global_styles: ['punk production', 'fast groove'],
    negative_global_styles: ['lyrics', 'spoken word'],
    sections: [section(0, 16, 'Whole', [GUITAR])],
    ...overrides,
  };
}

function cuts(validation: ReturnType<typeof validateSemanticCompositionPlan>): number[] {
  const points = [0];
  for (const section of validation.elevenLabsPlan.sections) {
    points.push(points[points.length - 1] + section.duration_ms);
  }
  return points;
}

describe('semantic composition plan', () => {
  it('parses the Gemini composition-plan schema', () => {
    const parsed = parseSemanticCompositionPlan({
      musicalIdentity: {
        genre: 'punk',
        bpm: 135,
        keyOrTonalCharacter: 'minor',
        instrumentation: ['distorted electric guitar'],
        rhythmicCharacter: 'driving eighth notes',
        harmonicCharacter: 'power chords',
        melodicCharacter: 'short guitar figures',
        texture: 'dry and close',
        overallArc: 'one impact then release',
      },
      syncEvents: [
        { timeSeconds: 4, label: 'Build', importance: 0.4, role: 'structural_transition', reason: 'energy changes' },
        { timeSeconds: 9, label: 'Impact', importance: 1.4, role: 'primary-impact', reason: 'payoff' },
      ],
      primaryEvent: { timeSeconds: 9, label: 'Impact', reason: 'payoff' },
      positive_global_styles: ['punk production'],
      negative_global_styles: ['lyrics'],
      sections: [section(0, 9, 'Build', [BUILD]), section(9, 16, 'Release', [RELEASE])],
    });

    assert.ok(parsed);
    assert.equal(parsed.musicalIdentity.bpm, 135);
    assert.equal(parsed.syncEvents[1].role, 'primary_impact');
    assert.equal(parsed.syncEvents[1].importance, 1);
    assert.equal(parsed.primaryEvent?.timeSeconds, 9);
    assert.equal(parsed.sections.length, 2);
    assert.equal(parseSemanticCompositionPlan({ note: 'no plan' }), null);
  });

  it('rejects a malformed timestamp and does not invent a replacement primary', () => {
    const source = plan({
      primaryEvent: { timeSeconds: 99, label: 'Outside', reason: 'bad' },
      syncEvents: [event({ timeSeconds: 40, role: 'secondary_accent', label: 'Late' })],
      sections: [section(0, 16, 'Whole', [GUITAR]), { ...section(5, 4, 'Backwards', ['nope']) }],
    });
    const snapshot = structuredClone(source);
    const validation = validateSemanticCompositionPlan(source, 16);

    assert.equal(validation.primaryPreserved, false);
    assert.equal(validation.primaryTimeSeconds, null);
    assert.equal(validation.semantic.syncEvents.some((item) => item.label === 'Late'), false);
    assert.equal(validation.semantic.sections.some((item) => item.section_name === 'Backwards'), false);
    assert.ok(validation.issues.some((issue) => issue.level === 'rejected'));
    assert.deepEqual(source, snapshot);
  });

  it('repairs overlapping sections and inconsistent durations', () => {
    const validation = validateSemanticCompositionPlan(plan({
      sections: [
        section(0, 10, 'First', [GUITAR]),
        { ...section(8, 16, 'Second', [RELEASE]), duration_ms: 100 },
      ],
    }), 16);

    assert.equal(validation.inputOverlappedOrGapped, true);
    assert.equal(validation.minimumDurationOk, true);
    assert.equal(validation.totalDurationMs, 16000);
    let cursor = 0;
    for (const section of validation.semantic.sections) {
      assert.equal(section.start_seconds * 1000, cursor);
      assert.ok(section.duration_ms >= 3000);
      assert.equal(section.duration_ms, Math.round((section.end_seconds - section.start_seconds) * 1000));
      cursor += section.duration_ms;
    }
    assert.equal(cursor, 16000);
    assert.ok(validation.issues.some((issue) => issue.message.includes('duration_ms')));
  });

  it('keeps a primary timestamp exact when a nearer boundary would replace it', () => {
    const validation = validateSemanticCompositionPlan(plan({
      primaryEvent: { timeSeconds: 9.12, label: 'Impact', reason: 'payoff' },
      sections: [section(0, 9, 'Before', [BUILD]), section(9, 16, 'After', [RELEASE])],
    }), 16);

    assert.equal(validation.primaryPreserved, true);
    assert.equal(validation.primaryTimeSeconds, 9.12);
    assert.deepEqual(cuts(validation), [0, 9120, 16000]);
  });

  it('does not let a secondary boundary under 3 seconds displace the primary event', () => {
    const validation = validateSemanticCompositionPlan(plan({
      primaryEvent: { timeSeconds: 9, label: 'Impact', reason: 'payoff' },
      syncEvents: [
        event({ timeSeconds: 7, role: 'secondary_accent', label: 'Flip', importance: 0.95 }),
        event({ timeSeconds: 9, role: 'primary_impact', label: 'Impact', importance: 0.8 }),
      ],
      sections: [section(0, 7, 'Approach', [BUILD], ['premature climax']), section(7, 15.68, 'After', [RELEASE])],
    }), SKATEBOARD_DURATION_SECONDS);

    assert.equal(validation.primaryPreserved, true);
    assert.deepEqual(cuts(validation), [0, 9000, 15680]);
    assert.equal(cuts(validation).includes(7000), false);
    const before = validation.elevenLabsPlan.sections[0].positive_local_styles.join(' | ');
    assert.match(before, /secondary accent at 7\.000s \(Flip\)/);
    assert.match(before, new RegExp(BUILD));
    assert.match(validation.elevenLabsPlan.sections[1].positive_local_styles.join(' | '), new RegExp(RELEASE));
    assert.equal(validation.totalDurationMs, 15680);
  });

  it('keeps a legal earlier structural boundary and the rich ElevenLabs fields', () => {
    const longStyle = `${GUITAR} ${'and extra color '.repeat(8)}`;
    const validation = validateSemanticCompositionPlan(plan({
      primaryEvent: { timeSeconds: 9, label: 'Impact', reason: 'payoff' },
      syncEvents: [event({ timeSeconds: 7, role: 'secondary_accent', label: 'Flip' })],
      sections: [
        section(0, 4, 'Anticipation', [longStyle], ['explosive final hit'], 'anticipation'),
        section(4, 9, 'Build', [BUILD], ['maximum intensity', 'competing climax'], 'build'),
        section(9, 15.68, 'Release', [RELEASE], ['second climax'], 'release'),
      ],
    }), SKATEBOARD_DURATION_SECONDS);

    assert.equal(validation.status === 'invalid', false);
    assert.equal(validation.primaryPreserved, true);
    assert.deepEqual(cuts(validation), [0, 4000, 9000, 15680]);
    const body = toElevenLabsMusicBody(validation.elevenLabsPlan);
    assert.equal(body.model_id, 'music_v1');
    assert.equal(body.respect_sections_durations, true);
    assert.ok(body.composition_plan.positive_global_styles.includes('punk'));
    assert.ok(body.composition_plan.positive_global_styles.includes('135 BPM'));
    assert.ok(body.composition_plan.positive_global_styles.includes('distorted electric guitar'));
    assert.ok(body.composition_plan.negative_global_styles.includes('lyrics'));
    assert.ok(body.composition_plan.sections[0].positive_local_styles[0].length <= 100);
    assert.match(body.composition_plan.sections[0].positive_local_styles[0], /muted distorted guitar/);
    assert.ok(body.composition_plan.sections[1].negative_local_styles.includes('maximum intensity'));
    assert.ok(body.composition_plan.sections[2].negative_local_styles.includes('second climax'));
    assert.deepEqual(body.composition_plan.sections[2].lines, []);
    assert.match(body.composition_plan.sections[1].positive_local_styles.join(' | '), /secondary accent at 7\.000s \(Flip\)/);
  });

  it('does not let an action peak override a Gemini primary event', () => {
    const result = {
      ...skateboardAnalysis,
      analysis: {
        ...skateboardAnalysis.analysis,
        compositionPlan: plan({
          primaryEvent: { timeSeconds: 9, label: 'Impact', reason: 'narrative payoff' },
          syncEvents: [event({ timeSeconds: 7, role: 'secondary_accent', label: 'Flip' })],
          sections: [
            section(0, 4, 'Anticipation', [GUITAR]),
            section(4, 9, 'Build', [BUILD]),
            section(9, SKATEBOARD_DURATION_SECONDS, 'Release', [RELEASE]),
          ],
        }),
      },
    };
    const generated = compositionPlanForAnalysis(result);
    const points = [0];
    for (const item of generated.sections) points.push(points[points.length - 1] + item.duration_ms);
    assert.deepEqual(points, [0, 4000, 9000, 15680]);
    assert.equal(points.includes(7000), false);
    assert.equal(points.includes(10336), false);
  });

  it('asks Gemini to choose the primary event instead of copying action peaks', () => {
    const prompt = buildAnalysisPrompt(15.68);
    assert.match(prompt, /primary_impact/);
    assert.match(prompt, /at most one primary_impact/i);
    assert.match(prompt, /actionPeakTime/);
    assert.match(prompt, /Do not output this checklist/);
    assert.match(prompt, /compositionPlan/);
  });
});
