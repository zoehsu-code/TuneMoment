import fs from 'fs';
import path from 'path';
import { formatCompositionDebugReport } from './compositionDebug';
import { parseSemanticCompositionPlan, validateSemanticCompositionPlan } from '@/lib/providers/music/semanticCompositionPlan';

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument) {
    console.log('Pass a Gemini JSON file or a video path.');
    console.log('  npm run debug:composition -- path/to/gemini.json');
    console.log('  GEMINI_API_KEY=... npm run debug:composition -- path/to/video.mp4');
    console.log('');
    console.log('This command does not call ElevenLabs.');
    console.log('The saved skateboard fixture has timeline analysis only. A composition plan has to come from Gemini.');
    return;
  }

  const resolved = path.resolve(argument);
  if (argument.endsWith('.json')) {
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
    const plan = readPlan(parsed);
    if (!plan) {
      console.error('The JSON file does not contain a compositionPlan.');
      process.exitCode = 1;
      return;
    }
    const duration = readDuration(parsed) ?? plan.sections.at(-1)?.end_seconds ?? 30;
    console.log(formatCompositionDebugReport(validateSemanticCompositionPlan(plan, duration)));
    console.log('');
    console.log('DRY RUN COMPLETE — no Gemini or ElevenLabs API calls were made.');
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set, so this video was not analyzed. No ElevenLabs call was made.');
    process.exitCode = 1;
    return;
  }

  const { GeminiAnalyzer } = await import('@/lib/providers/analysis/GeminiAnalyzer');
  const analyzer = new GeminiAnalyzer();
  const result = await analyzer.analyze(resolved, {
    filename: path.basename(resolved),
    sizeBytes: fs.statSync(resolved).size,
  });
  const plan = result.analysis.compositionPlan;
  if (!plan) {
    console.error('Gemini returned an analysis without a compositionPlan.');
    process.exitCode = 1;
    return;
  }
  const duration = result.metadata.durationSeconds ?? plan.sections.at(-1)?.end_seconds ?? 30;
  console.log(formatCompositionDebugReport(validateSemanticCompositionPlan(plan, duration)));
  console.log('');
  console.log('DRY RUN COMPLETE — Gemini was called. No ElevenLabs API call was made.');
}

function readPlan(parsed: unknown) {
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (record.compositionPlan) return parseSemanticCompositionPlan(record.compositionPlan);
  const analysis = record.analysis;
  if (analysis && typeof analysis === 'object' && 'compositionPlan' in analysis) {
    return parseSemanticCompositionPlan((analysis as Record<string, unknown>).compositionPlan);
  }
  return parseSemanticCompositionPlan(record);
}

function readDuration(parsed: unknown): number | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const record = parsed as Record<string, unknown>;
  if (typeof record.videoDurationSeconds === 'number') return record.videoDurationSeconds;
  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object') {
    const duration = (metadata as Record<string, unknown>).durationSeconds;
    if (typeof duration === 'number') return duration;
  }
  return undefined;
}

void main();
