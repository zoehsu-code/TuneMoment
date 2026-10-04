'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, RefreshCw, Send, SlidersHorizontal, Upload } from 'lucide-react';
import { CombinedVideoPlayer } from '@/components/player/CombinedVideoPlayer';
import { useWorkflow } from '@/hooks/useWorkflow';
import { validateVideoFile } from '@/lib/utils';
import { useFeed } from '@/components/tunemoment/feed';

const STATUS_LINES = [
  'Understanding your video…',
  'Finding musical moments…',
  'Composing your soundtrack…',
];

function publicError(message: string | null): string | null {
  if (!message) return null;
  if (/xai|grok|eleven|gemini|api[_ -]?key|composition_plan/i.test(message)) {
    return "We couldn't create a soundtrack for this video. Try again.";
  }
  return message;
}

export function CreateExperience() {
  const { state, selectFile, removeFile, upload, generate, reset } = useWorkflow();
  const { publish, isPublished } = useFeed();
  const inputRef = useRef<HTMLInputElement>(null);
  const wantGenerate = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [justPublished, setJustPublished] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { step, videoFile, videoObjectUrl, originalAudioUrl, uploadedVideoPath, score, error } = state;
  const working = step === 'uploading' || step === 'generating';
  const failed = Boolean(localError ?? error) && !working;
  // `creating` covers the gap between upload finishing and generate starting.
  // `working` keeps the overlay up if that local flag is lost mid-request.
  const showCreating = (creating || working) && step !== 'completed' && !failed;
  const message = publicError(localError ?? error);

  useEffect(() => {
    if (!showCreating) return;
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [showCreating]);

  useEffect(() => {
    if (!wantGenerate.current) return;
    if (step === 'uploaded' && uploadedVideoPath) {
      wantGenerate.current = false;
      generate();
    } else if (step === 'idle' && error) {
      wantGenerate.current = false;
    }
  }, [step, uploadedVideoPath, error, generate]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validateVideoFile(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    setJustPublished(false);
    selectFile(file);
  };

  const onGenerate = () => {
    setCreating(true);
    setLocalError(null);
    setJustPublished(false);
    setStatusIndex(0);
    if (uploadedVideoPath && (step === 'uploaded' || step === 'completed')) {
      generate();
      return;
    }
    if (!videoFile) return;
    wantGenerate.current = true;
    upload();
  };

  const onDownload = async () => {
    if (!score || !uploadedVideoPath || downloading) return;
    setDownloading(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: uploadedVideoPath, audioUrl: score.audioUrl }),
      });
      const data = (await res.json()) as { url?: string; filename?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "We couldn't prepare this video for download.");
      }
      const link = document.createElement('a');
      link.href = data.url;
      link.download = data.filename ?? 'tunemoment.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "We couldn't prepare this video for download.");
    } finally {
      setDownloading(false);
    }
  };

  const onPublish = () => {
    if (!score || !videoFile || !videoObjectUrl) return;
    if (isPublished(score.audioUrl)) {
      setJustPublished(true);
      return;
    }
    publish({
      videoUrl: URL.createObjectURL(videoFile),
      audioUrl: score.audioUrl,
      soundtrack: 'AI Soundtrack',
    });
    setJustPublished(true);
  };

  const studioHref = score
    ? `/daw?${new URLSearchParams({
        score: score.audioUrl,
        ...(originalAudioUrl ? { original: originalAudioUrl } : {}),
      }).toString()}`
    : '/daw';

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      {step !== 'completed' && (
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[#17171B] sm:text-4xl">
            Turn your video into <span className="tm-gradient-text">music.</span>
          </h1>
          <p className="mt-2 text-base text-[#6F6F7B]">
            Upload a moment. Give it its own soundtrack.
          </p>
        </header>
      )}

      {!videoFile && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            chooseFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center rounded-3xl border border-dashed bg-white px-6 py-16 text-center transition-colors ${
            dragging
              ? 'border-[#C026D3] bg-[#FDF2F8]'
              : 'border-[#DADAE2] hover:border-[#C026D3] hover:bg-[#FDF6FB]'
          }`}
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6F6F9] text-[#7C3AED]">
            <Upload className="h-6 w-6" />
          </span>
          <span className="text-base font-medium text-[#17171B]">Drop your video here</span>
          <span className="mt-1 text-sm text-[#6F6F7B]">or choose a file</span>
          <span className="mt-4 text-xs text-[#9A9AA5]">MP4 video</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="sr-only"
        onChange={(e) => {
          chooseFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {videoObjectUrl && step !== 'completed' && (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            src={videoObjectUrl}
            muted
            playsInline
            controls={!showCreating}
            preload="metadata"
            className="mx-auto max-h-[68vh] w-full object-contain"
          />
          {showCreating && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/75 via-black/20 to-black/10 px-5 pb-6"
              role="status"
              aria-live="polite"
            >
              <div className="w-full max-w-xs">
                <div className="h-1 overflow-hidden rounded-full bg-white/25">
                  <div className="tm-gradient tm-gradient-animated animate-indeterminate h-full w-1/3 rounded-full" />
                </div>
                <p className="mt-3 text-center text-sm font-medium text-white">{STATUS_LINES[statusIndex]}</p>
                <div className="mt-3 flex items-end justify-center gap-1" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1 origin-bottom rounded-full bg-white/90 animate-eq"
                      style={{ height: 10 + (i % 3) * 8, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {videoFile && !showCreating && step !== 'completed' && (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onGenerate}
            className="tm-gradient flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white transition-transform hover:brightness-105 active:scale-[0.99]"
          >
            Generate Music
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setLocalError(null); removeFile(); }}
            className="w-full text-center text-sm text-[#6F6F7B] hover:text-[#17171B]"
          >
            Choose a different video
          </button>
        </div>
      )}

      {message && !showCreating && (
        <div role="alert" className="mt-4 rounded-2xl border border-[#F43F5E]/30 bg-[#FFF5F7] px-4 py-3 text-sm text-[#17171B]">
          <p>{message}</p>
          <button
            type="button"
            onClick={onGenerate}
            className="mt-2 text-sm font-medium text-[#7C3AED]"
          >
            Try again
          </button>
        </div>
      )}

      {step === 'completed' && score && videoObjectUrl && (
        <div className="animate-fade-in">
          <CombinedVideoPlayer
            variant="social"
            videoSrc={videoObjectUrl}
            audioSrc={score.audioUrl}
            originalAudioUrl={originalAudioUrl}
            includeOriginalAudio={false}
          />

          <div className="mt-3 flex items-center gap-2 text-sm">
            <AudioLines className="h-4 w-4 text-[#C026D3]" />
            <span className="tm-gradient-text font-medium">AI Soundtrack</span>
          </div>

          <button
            type="button"
            onClick={onDownload}
            disabled={downloading || !uploadedVideoPath}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#E7E7EC] bg-white text-sm font-semibold text-[#17171B] transition-colors hover:border-[#7C3AED] hover:text-[#7C3AED] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing video…' : 'Download'}
          </button>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onGenerate}
              disabled={working}
              className="order-2 inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#E7E7EC] bg-white text-sm font-medium text-[#17171B] transition-colors hover:border-[#C026D3] hover:text-[#7C3AED] sm:order-1"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="tm-gradient order-1 inline-flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-sm transition-transform hover:brightness-105 active:scale-[0.99] sm:order-2"
            >
              <Send className="h-4 w-4" />
              {justPublished || isPublished(score.audioUrl) ? 'Published' : 'Publish'}
            </button>
            <Link
              href={studioHref}
              className="order-3 inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#E7E7EC] bg-white text-sm font-medium text-[#17171B] transition-colors hover:border-[#7C3AED] hover:text-[#7C3AED]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Studio
            </Link>
          </div>

          {(justPublished || isPublished(score.audioUrl)) && (
            <p className="mt-3 text-center text-sm text-[#6F6F7B]">
              Published to Explore.{' '}
              <Link href="/explore" className="font-medium text-[#7C3AED]">
                View it
              </Link>
            </p>
          )}

          <button
            type="button"
            onClick={() => { setCreating(false); setJustPublished(false); setLocalError(null); reset(); }}
            className="mt-4 w-full text-center text-sm text-[#9A9AA5] hover:text-[#6F6F7B]"
          >
            New moment
          </button>

          {score.prompt && (
            <details className="mt-8 rounded-2xl border border-[#E7E7EC] bg-[#FAFAFC] px-4 py-3 text-sm text-[#6F6F7B]">
              <summary className="cursor-pointer text-[#9A9AA5]">Generation details</summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[#6F6F7B]">
                {score.prompt}
              </pre>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
