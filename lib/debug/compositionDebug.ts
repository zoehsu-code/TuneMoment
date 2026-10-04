import type { CompositionValidation } from '@/lib/providers/music/semanticCompositionPlan';
import { toElevenLabsMusicBody } from '@/lib/providers/music/semanticCompositionPlan';

export function formatCompositionDebugReport(validation: CompositionValidation): string {
  const plan = validation.semantic;
  const identity = plan.musicalIdentity;
  const lines = [
    '=== GEMINI MUSICAL IDENTITY ===',
    '',
    `Genre: ${identity.genre || '(none)'}`,
    `BPM: ${Number.isFinite(identity.bpm) && identity.bpm > 0 ? String(identity.bpm) : '(none)'}`,
    `Key / tonal character: ${identity.keyOrTonalCharacter || '(none)'}`,
    `Instrumentation: ${identity.instrumentation.join(', ') || '(none)'}`,
    `Rhythm: ${identity.rhythmicCharacter || '(none)'}`,
    `Harmony: ${identity.harmonicCharacter || '(none)'}`,
    `Melody: ${identity.melodicCharacter || '(none)'}`,
    `Texture: ${identity.texture || '(none)'}`,
    `Overall arc: ${identity.overallArc || '(none)'}`,
    '',
    '=== GEMINI SYNC EVENTS ===',
    '',
    plan.syncEvents.length === 0
      ? '(none)'
      : plan.syncEvents
          .map((event) => `${seconds(event.timeSeconds)}s  ${event.role.padEnd(24)} importance=${event.importance.toFixed(2)}  ${event.label}`)
          .join('\n'),
    '',
    '=== PRIMARY EVENT ===',
    '',
    plan.primaryEvent
      ? `time: ${seconds(plan.primaryEvent.timeSeconds)}s\nlabel: ${plan.primaryEvent.label}\nreason: ${plan.primaryEvent.reason || '(none)'}`
      : '(none)',
    '',
    '=== GEMINI COMPOSITION SECTIONS ===',
    '',
    plan.sections.map((section) => {
      const internal = plan.syncEvents.filter((event) => {
        const atStart = Math.abs(event.timeSeconds - section.start_seconds) < 0.001;
        const inside = event.timeSeconds >= section.start_seconds - 0.0005
          && event.timeSeconds < section.end_seconds - (section === plan.sections[plan.sections.length - 1] ? -0.0005 : 0.0005);
        return inside && !atStart;
      });
      return [
        `${seconds(section.start_seconds)}–${seconds(section.end_seconds)}  ${section.duration_ms}ms  ${section.section_name}`,
        `Narrative function: ${section.narrative_function || '(none)'}`,
        'Positive:',
        ...(section.positive_local_styles.length ? section.positive_local_styles.map((style) => `- ${style}`) : ['- (none)']),
        'Negative:',
        ...(section.negative_local_styles.length ? section.negative_local_styles.map((style) => `- ${style}`) : ['- (none)']),
        'Internal sync events:',
        ...(internal.length ? internal.map((event) => `- ${seconds(event.timeSeconds)}s ${event.role} ${event.label}`) : ['- (none)']),
      ].join('\n');
    }).join('\n\n'),
    '',
    '=== VALIDATION ===',
    '',
    `minimum duration: ${validation.minimumDurationOk ? 'ok' : 'failed'}`,
    `total duration: ${validation.totalDurationMs}ms`,
    `overlaps: ${validation.inputOverlappedOrGapped ? 'repaired' : 'none'}`,
    `primary preserved: ${validation.primaryPreserved ? 'yes' : 'no'}${validation.primaryTimeSeconds === null ? '' : ` at ${seconds(validation.primaryTimeSeconds)}s`}`,
    `result: ${validation.status}`,
    ...(validation.issues.length ? ['', ...validation.issues.map((issue) => `- ${issue.level}: ${issue.message}`)] : []),
    '',
    '=== ELEVENLABS-READY PLAN ===',
    '',
    JSON.stringify(toElevenLabsMusicBody(validation.elevenLabsPlan), null, 2),
  ];
  return lines.join('\n');
}

function seconds(value: number): string {
  return value.toFixed(3);
}
