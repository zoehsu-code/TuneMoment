'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface CombinedVideoPlayerProps {
  /** Blob/object URL of the original uploaded video. */
  videoSrc: string;
  /** URL of the generated score MP3 (e.g. /generated/{id}.mp3). */
  audioSrc: string;
  /** Browser-playable MP3 of the video's original audio, or null if unavailable. */
  originalAudioUrl: string | null;
  /** When false (or no original audio), the original soundtrack is muted; the score is always heard. */
  includeOriginalAudio: boolean;
  /** `social` draws transport on the video so it reads as one finished post. */
  variant?: 'default' | 'social';
}

// If a slaved audio track drifts more than this from the master video clock, snap it back.
const DRIFT_TOLERANCE_SECONDS = 0.25;

/**
 * Plays the original video in sync with the generated score under a single
 * transport. The <video> element is the master clock and is ALWAYS muted — its
 * own audio track is frequently in a codec the browser can't decode, so we never
 * rely on it. Instead two <audio> elements are slaved to the video clock:
 *   - the generated score (always audible), and
 *   - the ffmpeg-extracted original audio (audible only when includeOriginalAudio).
 * Both are drift-corrected toward the video on every timeupdate.
 */
export function CombinedVideoPlayer({
  videoSrc,
  audioSrc,
  originalAudioUrl,
  includeOriginalAudio,
  variant = 'default',
}: CombinedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scoreRef = useRef<HTMLAudioElement>(null);
  const originalRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [scoreReady, setScoreReady] = useState(false);

  const isLoaded = videoReady && scoreReady;

  // The video's own audio is never used — keep it hard-muted at all times.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = true;
  }, [videoSrc]);

  // Gate the original-audio track on the toggle, live (no playback interruption).
  useEffect(() => {
    const original = originalRef.current;
    if (original) original.muted = !includeOriginalAudio;
  }, [includeOriginalAudio, originalAudioUrl]);

  // Wire up media events. Video is the master timeline; the audios follow it.
  useEffect(() => {
    const video = videoRef.current;
    const score = scoreRef.current;
    if (!video || !score) return;

    const slaved = (): HTMLAudioElement[] =>
      [scoreRef.current, originalRef.current].filter((a): a is HTMLAudioElement => a !== null);

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Drift-correct each slaved audio toward the master video clock.
      for (const a of slaved()) {
        if (Math.abs(a.currentTime - video.currentTime) > DRIFT_TOLERANCE_SECONDS) {
          a.currentTime = video.currentTime;
        }
      }
    };
    const onVideoMeta = () => { setDuration(video.duration); setVideoReady(true); };
    const onScoreMeta = () => setScoreReady(true);
    const onEnded = () => {
      video.pause();
      video.currentTime = 0;
      for (const a of slaved()) { a.pause(); a.currentTime = 0; }
      setIsPlaying(false);
      setCurrentTime(0);
    };
    // Keep the slaved audios in lockstep if the browser pauses/resumes the video.
    const onVideoPause = () => { for (const a of slaved()) { if (!a.paused) a.pause(); } };
    const onVideoPlay = () => {
      if (video.currentTime >= video.duration) return;
      for (const a of slaved()) { if (a.paused) void a.play().catch(() => undefined); }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onVideoMeta);
    video.addEventListener('ended', onEnded);
    video.addEventListener('pause', onVideoPause);
    video.addEventListener('play', onVideoPlay);
    score.addEventListener('loadedmetadata', onScoreMeta);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onVideoMeta);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('pause', onVideoPause);
      video.removeEventListener('play', onVideoPlay);
      score.removeEventListener('loadedmetadata', onScoreMeta);
    };
  }, [videoSrc, audioSrc, originalAudioUrl]);

  // Pause every element when this player unmounts (e.g. switching tabs).
  useEffect(() => {
    const video = videoRef.current;
    const score = scoreRef.current;
    const original = originalRef.current;
    return () => {
      video?.pause();
      score?.pause();
      original?.pause();
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    const slaved = [scoreRef.current, originalRef.current].filter(
      (a): a is HTMLAudioElement => a !== null
    );

    if (isPlaying) {
      video.pause();
      for (const a of slaved) a.pause();
      setIsPlaying(false);
    } else {
      // Align before playing so everything starts together.
      for (const a of slaved) a.currentTime = video.currentTime;
      try {
        await Promise.all([video.play(), ...slaved.map((a) => a.play())]);
        setIsPlaying(true);
      } catch {
        video.pause();
        for (const a of slaved) a.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying, isLoaded]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    if (scoreRef.current) scoreRef.current.currentTime = t;
    if (originalRef.current) originalRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    if (scoreRef.current) {
      scoreRef.current.pause();
      scoreRef.current.currentTime = 0;
    }
    if (originalRef.current) {
      originalRef.current.pause();
      originalRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (variant === 'social') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="metadata"
          className="mx-auto max-h-[72vh] w-full bg-black object-contain"
          onClick={() => { void togglePlay(); }}
        />
        <audio ref={scoreRef} src={audioSrc} preload="metadata" />
        {originalAudioUrl && <audio ref={originalRef} src={originalAudioUrl} preload="metadata" />}

        <button
          type="button"
          onClick={() => { void togglePlay(); }}
          disabled={!isLoaded}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#17171B] shadow-sm transition-opacity hover:bg-white disabled:opacity-40 ${
            isPlaying ? 'opacity-0 hover:opacity-100 focus:opacity-100' : 'opacity-100'
          }`}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" fill="currentColor" />}
        </button>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            disabled={!isLoaded}
            aria-label="Seek"
            className="w-full cursor-pointer appearance-none rounded-full
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:border-0 disabled:cursor-not-allowed"
            style={{
              height: '3px',
              background: `linear-gradient(to right, #ffffff ${progress}%, rgba(255,255,255,0.35) ${progress}%)`,
            }}
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-white/90">
            <span className="tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
            <button
              type="button"
              onClick={restart}
              aria-label="Restart"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video surface (always muted — audio comes from the slaved tracks below) */}
      <div className="overflow-hidden rounded-lg border border-navy-700 bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="metadata"
          className="mx-auto max-h-[360px] w-full bg-black object-contain"
        />
      </div>

      {/* Slaved audio tracks, driven by the video clock */}
      <audio ref={scoreRef} src={audioSrc} preload="metadata" />
      {originalAudioUrl && <audio ref={originalRef} src={originalAudioUrl} preload="metadata" />}

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={currentTime}
        onChange={handleSeek}
        disabled={!isLoaded}
        aria-label="Seek video and score"
        className="w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#7C3AED] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#7C3AED]
          [&::-moz-range-thumb]:border-0 disabled:cursor-not-allowed"
        style={{
          height: '4px',
          background: `linear-gradient(to right, #7C3AED ${progress}%, #E7E7EC ${progress}%)`,
        }}
      />

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="tm-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPlaying ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <span className="tabular-nums text-sm text-cream-200">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>

        {!isLoaded && <span className="ml-auto text-xs text-cream-400">Loading video…</span>}
      </div>
    </div>
  );
}
