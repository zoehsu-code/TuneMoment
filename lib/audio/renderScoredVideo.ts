import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { generateId } from '@/lib/utils';
import { resolvedPath } from './ffmpegEnv';

const FFMPEG_CMD = process.env.FFMPEG_CMD ?? 'ffmpeg';
const RENDER_TIMEOUT_MS = 180_000;

function runFfmpeg(args: string[]): { status: number | null; stderr: string; missing: boolean } {
  const result = spawnSync(FFMPEG_CMD, args, {
    timeout: RENDER_TIMEOUT_MS,
    env: { ...process.env, PATH: resolvedPath() },
  });
  const missing = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
  return { status: result.status, stderr: result.stderr?.toString() ?? '', missing };
}

/**
 * Muxes an uploaded video with the generated soundtrack and writes an MP4
 * whose only audio is that score. Returns the public URL.
 */
export function renderScoredVideo(videoPath: string, audioPath: string): { url: string; filename: string } {
  const outDir = path.join(process.cwd(), 'public', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `tunemoment-${generateId()}.mp4`;
  const outPath = path.join(outDir, filename);

  const shared = ['-y', '-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-shortest'];
  const copy = runFfmpeg([
    ...shared,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outPath,
  ]);

  const copyOk = !copy.missing && copy.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  if (!copyOk) {
    fs.rmSync(outPath, { force: true });
    if (copy.missing) {
      throw new Error("We couldn't prepare this video for download.");
    }
    const encoded = runFfmpeg([
      ...shared,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outPath,
    ]);
    const encodedOk = encoded.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
    if (!encodedOk) {
      console.error('[renderScoredVideo]', (encoded.stderr || copy.stderr).slice(-500));
      fs.rmSync(outPath, { force: true });
      throw new Error("We couldn't prepare this video for download.");
    }
  }

  return { url: `/generated/${filename}`, filename: 'tunemoment.mp4' };
}
