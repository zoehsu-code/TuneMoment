'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface TunePost {
  id: string;
  author: string;
  handle: string;
  createdAt: number;
  /** Session object URL of the uploaded video. Null for featured sample cards. */
  videoUrl: string | null;
  /** Generated soundtrack URL. Null for featured sample cards. */
  audioUrl: string | null;
  soundtrack: string;
  likes: number;
  liked: boolean;
  comments: string[];
  mine: boolean;
  accent: number;
}

interface PublishInput {
  videoUrl: string;
  audioUrl: string;
  soundtrack?: string;
}

interface FeedContextValue {
  posts: TunePost[];
  publish: (input: PublishInput) => string;
  toggleLike: (id: string) => void;
  addComment: (id: string, text: string) => void;
  isPublished: (audioUrl: string) => boolean;
}

const SAMPLE_POSTS: TunePost[] = [
  {
    id: 'featured-morning',
    author: 'TuneMoment',
    handle: 'tunemoment',
    createdAt: Date.now() - 1000 * 60 * 48,
    videoUrl: null,
    audioUrl: null,
    soundtrack: 'Soft morning',
    likes: 128,
    liked: false,
    comments: [],
    mine: false,
    accent: 0,
  },
  {
    id: 'featured-city',
    author: 'TuneMoment',
    handle: 'tunemoment',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    videoUrl: null,
    audioUrl: null,
    soundtrack: 'City lights',
    likes: 86,
    liked: false,
    comments: [],
    mine: false,
    accent: 1,
  },
  {
    id: 'featured-quiet',
    author: 'TuneMoment',
    handle: 'tunemoment',
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    videoUrl: null,
    audioUrl: null,
    soundtrack: 'Quiet room',
    likes: 54,
    liked: false,
    comments: [],
    mine: false,
    accent: 2,
  },
];

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<TunePost[]>(SAMPLE_POSTS);

  const publish = useCallback((input: PublishInput) => {
    const id = `moment-${Date.now()}`;
    const post: TunePost = {
      id,
      author: 'You',
      handle: 'you',
      createdAt: Date.now(),
      videoUrl: input.videoUrl,
      audioUrl: input.audioUrl,
      soundtrack: input.soundtrack?.trim() || 'AI Soundtrack',
      likes: 0,
      liked: false,
      comments: [],
      mine: true,
      accent: 0,
    };
    setPosts((prev) => [post, ...prev]);
    return id;
  }, []);

  const toggleLike = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== id) return post;
        const liked = !post.liked;
        return { ...post, liked, likes: post.likes + (liked ? 1 : -1) };
      }),
    );
  }, []);

  const addComment = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id ? { ...post, comments: [...post.comments, trimmed] } : post,
      ),
    );
  }, []);

  const isPublished = useCallback(
    (audioUrl: string) => posts.some((post) => post.mine && post.audioUrl === audioUrl),
    [posts],
  );

  const value = useMemo(
    () => ({ posts, publish, toggleLike, addComment, isPublished }),
    [posts, publish, toggleLike, addComment, isPublished],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used within FeedProvider');
  return ctx;
}

export function relativeTime(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
