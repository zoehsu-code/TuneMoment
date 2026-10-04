/**
 * Upload an MP4 to Grok, parse the composition_plan it returns, and send that
 * plan unchanged to ElevenLabs Music. The Grok model is XAI_MODEL from .env.local.
 *
 * Usage:
 *   npm run test:grok-video -- path/to/video.mp4
 */
import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import {
  askGrokForPlan,
  composeMusicFile,
  extractOutputText,
  grokModel,
  parseCompositionPlan,
  readFileId,
  uploadVideoToXai,
} from '@/lib/providers/music/grokScore';

loadEnv({ path: path.join(process.cwd(), '.env.local'), quiet: true });

async function main(): Promise<void> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('XAI_API_KEY is missing. Add it to .env.local and run this again.');
    process.exitCode = 1;
    return;
  }
  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    console.error('ELEVENLABS_API_KEY is missing. Add it to .env.local and run this again.');
    process.exitCode = 1;
    return;
  }

  const videoPath = resolveVideoPath(process.argv[2]);
  if (!videoPath) {
    console.error('No MP4 was found in the repository.');
    console.error('Pass a video path:');
    console.error('  npm run test:grok-video -- path/to/video.mp4');
    process.exitCode = 1;
    return;
  }

  console.log(`Video: ${videoPath}`);
  console.log(`Grok model: ${grokModel()}`);

  const upload = await uploadVideoToXai(apiKey, videoPath);
  console.log('\n=== UPLOAD RESPONSE ===');
  console.log(`HTTP ${upload.status}`);
  console.log(pretty(upload.body));

  if (!upload.ok) {
    process.exitCode = 1;
    return;
  }

  const fileId = readFileId(upload.body);
  console.log('\n=== FILE ID ===');
  console.log(fileId ?? '(missing)');
  if (!fileId) {
    console.error('The upload response did not include a file id.');
    process.exitCode = 1;
    return;
  }

  const grok = await askGrokForPlan(apiKey, fileId);
  if (!grok.ok) {
    console.error(`\nGrok request failed: HTTP ${grok.status}`);
    console.error(pretty(grok.body));
    process.exitCode = 1;
    return;
  }

  const outputText = extractOutputText(grok.body);
  let plan: ReturnType<typeof parseCompositionPlan>;
  try {
    plan = parseCompositionPlan(outputText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed to parse the Grok composition_plan. ${message}`);
    console.error('\n=== RAW GROK OUTPUT ===');
    console.error(outputText || pretty(grok.body));
    process.exitCode = 1;
    return;
  }

  console.log('\n=== COMPOSITION PLAN ===');
  console.log(JSON.stringify(plan, null, 2));

  console.log('\n=== GENERATING MUSIC ===');
  console.log('Using ElevenLabs music_v2_5...');
  const outputPath = await composeMusicFile(plan, 'grok-music.mp3');
  console.log('\n=== DONE ===');
  console.log(`Music saved to: ${outputPath}`);
}

function resolveVideoPath(argument: string | undefined): string | null {
  if (argument) {
    const resolved = path.resolve(argument);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      console.error(`Video file not found: ${resolved}`);
      return null;
    }
    return resolved;
  }
  return findFirstMp4(process.cwd());
}

function findFirstMp4(root: string): string | null {
  const skip = new Set(['node_modules', '.git', '.next']);
  const pending = [root];
  while (pending.length > 0) {
    const dir = pending.pop();
    if (!dir) continue;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) return full;
    }
  }
  return null;
}

function pretty(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
