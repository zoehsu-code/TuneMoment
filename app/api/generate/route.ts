import { NextResponse } from 'next/server';
import { assertUploadedVideoPath, generateScoreFromVideo } from '@/lib/providers/music/grokScore';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { videoPath?: unknown };

    if (typeof body.videoPath !== 'string' || body.videoPath.length === 0) {
      return NextResponse.json(
        { error: 'Missing uploaded video.' },
        { status: 400 },
      );
    }

    const videoPath = assertUploadedVideoPath(body.videoPath);
    const score = await generateScoreFromVideo(videoPath);
    return NextResponse.json(score);
  } catch (error) {
    console.error('[/api/generate]', error);
    const message = error instanceof Error ? error.message : 'Generation failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
