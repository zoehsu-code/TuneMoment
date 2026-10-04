import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { renderScoredVideo } from '@/lib/audio/renderScoredVideo';

export const maxDuration = 180;

function assertInside(rootDir: string, candidate: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolved)) {
    throw new Error('File was not found.');
  }
  return resolved;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { videoPath?: unknown; audioUrl?: unknown };
    if (typeof body.videoPath !== 'string' || body.videoPath.length === 0) {
      return NextResponse.json({ error: 'Missing uploaded video.' }, { status: 400 });
    }
    if (typeof body.audioUrl !== 'string' || !body.audioUrl.startsWith('/generated/')) {
      return NextResponse.json({ error: 'Missing soundtrack.' }, { status: 400 });
    }

    const videoPath = assertInside(path.join(process.cwd(), 'public', 'uploads'), body.videoPath);
    const audioPath = assertInside(
      path.join(process.cwd(), 'public', 'generated'),
      path.join(process.cwd(), 'public', body.audioUrl.replace(/^\//, '')),
    );
    const file = renderScoredVideo(videoPath, audioPath);
    return NextResponse.json(file);
  } catch (error) {
    console.error('[/api/download-video]', error);
    const message = error instanceof Error ? error.message : "We couldn't prepare this video for download.";
    const status = message === 'File was not found.' || message.startsWith('Missing') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
