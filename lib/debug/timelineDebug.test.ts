import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractTemporalEvents } from '@/lib/providers/analysis/extractTemporalEvents';
import { buildAlignedCompositionPlan } from '@/lib/providers/music/buildAlignedCompositionPlan';
import { skateboardAnalysis, SKATEBOARD_DURATION_SECONDS } from './skateboardAnalysis.ts';
import {
  buildTimelineDebugReport,
  DRY_RUN_COMPLETE_LINE,
  semanticBoundaryCandidates,
  temporalCandidates,
} from './timelineDebug.ts';

describe('skateboard timeline dry run', () => {
  it('converts the saved Gemini excerpt through the production extractor', () => {
    const events = extractTemporalEvents(skateboardAnalysis.analysis.timeline);

    assert.equal(events.length, 3);
    assert.equal(events[0].timeSeconds.toFixed(3), '2.000');
    assert.equal(events[0].startSeconds.toFixed(3), '0.000');
    assert.equal(events[0].endSeconds.toFixed(3), '4.000');
    assert.equal(events[0].label, 'Anticipation at the pier');
    assert.equal(events[0].salience, 0.5);
    assert.equal(events[0].eventScore, 0.65);

    assert.equal(events[1].timeSeconds.toFixed(3), '7.000');
    assert.equal(events[1].startSeconds.toFixed(3), '4.500');
    assert.equal(events[1].endSeconds.toFixed(3), '8.750');
    assert.equal(events[1].salience, 0.95);
    assert.equal(events[1].eventScore, 0.95);

    assert.equal(events[2].timeSeconds.toFixed(3), '10.336');
    assert.equal(events[2].startSeconds.toFixed(3), '9.000');
    assert.equal(events[2].endSeconds.toFixed(3), '14.344');
    assert.equal(events[2].salience, 0.6);
    assert.equal(events[2].eventScore, 0.7);
  });

  it('lists semantic boundaries between adjacent segments without ranking them', () => {
    const boundaries = semanticBoundaryCandidates(skateboardAnalysis.analysis.timeline);

    assert.equal(boundaries.length, 2);
    assert.equal(boundaries[0].timeSeconds, 4);
    assert.equal(boundaries[0].previous.label, 'Anticipation at the pier');
    assert.equal(boundaries[0].next.label, 'Ramp approach and mid-air flip');
    assert.equal(boundaries[0].previous.narrativeRole, 'intro');
    assert.equal(boundaries[0].next.narrativeRole, 'climax');
    assert.equal(boundaries[0].previous.energyLevel, 'low');
    assert.equal(boundaries[0].next.energyLevel, 'high');
    assert.equal(boundaries[0].previousSalience, 0.5);
    assert.equal(boundaries[0].previousEventScore, 0.65);
    assert.equal(boundaries[0].previous.transitionToNext, 'drum fill explodes into driving tempo');

    assert.equal(boundaries[1].timeSeconds, 9);
    assert.equal(boundaries[1].previous.narrativeRole, 'climax');
    assert.equal(boundaries[1].next.narrativeRole, 'resolution');
    assert.equal(boundaries[1].previous.energyLevel, 'high');
    assert.equal(boundaries[1].next.energyLevel, 'medium');
    assert.equal(boundaries[1].previousSalience, 0.95);
    assert.equal(boundaries[1].previousEventScore, 0.95);
    assert.equal(boundaries[1].previous.transitionToNext, 'cymbal crash resolves into open chords');
  });

  it('places action peaks and semantic boundaries in one time-ordered candidate list', () => {
    const events = extractTemporalEvents(skateboardAnalysis.analysis.timeline);
    const candidates = temporalCandidates(skateboardAnalysis.analysis.timeline, events);

    assert.deepEqual(
      candidates.map((candidate) => [candidate.timeSeconds.toFixed(3), candidate.type]),
      [
        ['2.000', 'action_peak'],
        ['4.000', 'semantic_boundary'],
        ['7.000', 'action_peak'],
        ['9.000', 'semantic_boundary'],
        ['10.336', 'action_peak'],
      ],
    );
  });

  it('prints the current production plan and does not call out to an API', () => {
    const report = buildTimelineDebugReport(skateboardAnalysis, SKATEBOARD_DURATION_SECONDS);
    const events = extractTemporalEvents(skateboardAnalysis.analysis.timeline);
    const plan = buildAlignedCompositionPlan(
      skateboardAnalysis.analysis,
      events,
      SKATEBOARD_DURATION_SECONDS,
    );

    assert.match(report, /=== ORIGINAL GEMINI TIMELINE ===/);
    assert.match(report, /0\.000–4\.000\nAnticipation at the pier\nrole: intro\nmood: suspenseful\nenergy: low/);
    assert.match(report, /4\.000–9\.000\nRamp approach and mid-air flip\nrole: climax\nmood: energetic\nenergy: high/);
    assert.match(report, /9\.000–15\.680\nSplash and aftermath\nrole: resolution\nmood: happy\nenergy: medium/);

    assert.match(report, /=== ACTION-PEAK EVENTS ===/);
    assert.match(report, /2\.000s\nAnticipation at the pier\nsalience: 0\.50\neventScore: 0\.65/);
    assert.match(report, /actionStart: 0\.000s\nactionEnd: 4\.000s/);
    assert.match(report, /7\.000s\nRamp approach and mid-air flip\nsalience: 0\.95\neventScore: 0\.95/);
    assert.match(report, /10\.336s\nSplash and aftermath\nsalience: 0\.60\neventScore: 0\.70/);

    assert.match(report, /=== SEMANTIC BOUNDARY CANDIDATES ===/);
    assert.match(report, /4\.000s\nAnticipation at the pier\n→ Ramp approach and mid-air flip\nintro → climax/);
    assert.match(report, /9\.000s\nRamp approach and mid-air flip\n→ Splash and aftermath\nclimax → resolution/);
    assert.match(report, /previous salience: 0\.95\nprevious eventScore: 0\.95/);
    assert.match(report, /transition: cymbal crash resolves into open chords/);

    assert.match(report, /=== TEMPORAL CANDIDATES ===/);
    assert.match(report, /2\.000\s+action_peak\s+Anticipation at the pier/);
    assert.match(report, /4\.000\s+semantic_boundary\s+intro → climax/);
    assert.match(report, /7\.000\s+action_peak\s+Ramp approach and mid-air flip/);
    assert.match(report, /9\.000\s+semantic_boundary\s+climax → resolution/);
    assert.match(report, /10\.336\s+action_peak\s+Splash and aftermath/);

    assert.match(report, /=== CURRENT PLANNER RESULT ===/);
    assert.match(report, /0\.000 → 4\.000 → 7\.000 → 10\.336 → 15\.680/);
    assert.match(
      report,
      /9\.000s not kept — 2000ms from the accepted action peak at 7\.000s; 1336ms from the accepted action peak at 10\.336s/,
    );
    const jsonStart = report.indexOf('{');
    const jsonEnd = report.lastIndexOf('}');
    const body = JSON.parse(report.slice(jsonStart, jsonEnd + 1)) as {
      model_id: string;
      respect_sections_durations: boolean;
      composition_plan: typeof plan;
    };
    assert.equal(body.model_id, 'music_v1');
    assert.equal(body.respect_sections_durations, true);
    assert.deepEqual(body.composition_plan, plan);
    assert.equal(
      body.composition_plan.sections.reduce((sum, section) => sum + section.duration_ms, 0),
      15680,
    );
    assert.match(report, new RegExp(DRY_RUN_COMPLETE_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(report.trimEnd().endsWith(DRY_RUN_COMPLETE_LINE), true);
  });
});
