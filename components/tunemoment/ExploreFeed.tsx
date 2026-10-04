'use client';

import { useState } from 'react';
import { AudioLines, Heart, MessageCircle, Send } from 'lucide-react';
import { CombinedVideoPlayer } from '@/components/player/CombinedVideoPlayer';
import { relativeTime, useFeed, type TunePost } from '@/components/tunemoment/feed';

const ACCENTS = [
  'linear-gradient(160deg, #7C3AED 0%, #EC4899 55%, #FB923C 100%)',
  'linear-gradient(160deg, #4F7CFF 0%, #7C3AED 50%, #C026D3 100%)',
  'linear-gradient(160deg, #22B8CF 0%, #7C3AED 45%, #EC4899 100%)',
];

export function ExploreFeed() {
  const { posts } = useFeed();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="sr-only">Explore</h1>
      <div className="divide-y divide-[#E7E7EC]">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </main>
  );
}

function PostCard({ post }: { post: TunePost }) {
  const { toggleLike, addComment } = useFeed();
  const [draft, setDraft] = useState('');
  const [composer, setComposer] = useState(false);
  const [shared, setShared] = useState(false);

  const share = async () => {
    const text = `${post.soundtrack} on TuneMoment`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TuneMoment', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
    } catch {
      setShared(false);
    }
  };

  return (
    <article id={post.id} className="py-6">
      <header className="mb-3 flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: ACCENTS[post.accent % ACCENTS.length] }}
        >
          {post.author.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#17171B]">{post.author}</p>
          <p className="text-xs text-[#9A9AA5]">@{post.handle} · {relativeTime(post.createdAt)}</p>
        </div>
      </header>

      {post.videoUrl && post.audioUrl ? (
        <CombinedVideoPlayer
          variant="social"
          videoSrc={post.videoUrl}
          audioSrc={post.audioUrl}
          originalAudioUrl={null}
          includeOriginalAudio={false}
        />
      ) : (
        <div
          className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl"
          style={{ background: ACCENTS[post.accent % ACCENTS.length] }}
          role="img"
          aria-label={post.soundtrack}
        >
          <span className="rounded-full bg-white/20 p-4 text-white">
            <AudioLines className="h-8 w-8" />
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm">
        <AudioLines className="h-4 w-4 text-[#C026D3]" />
        <span className="tm-gradient-text font-medium">{post.soundtrack}</span>
      </div>

      <div className="mt-3 flex items-center gap-5 text-[#17171B]">
        <button
          type="button"
          onClick={() => toggleLike(post.id)}
          className="inline-flex items-center gap-1.5 text-sm"
          aria-pressed={post.liked}
          aria-label={post.liked ? 'Unlike' : 'Like'}
        >
          <Heart className={`h-5 w-5 ${post.liked ? 'fill-[#F43F5E] text-[#F43F5E]' : ''}`} />
          {post.likes}
        </button>
        <button
          type="button"
          onClick={() => setComposer((open) => !open)}
          className="inline-flex items-center gap-1.5 text-sm"
          aria-label="Comment"
        >
          <MessageCircle className="h-5 w-5" />
          {post.comments.length}
        </button>
        <button type="button" onClick={() => { void share(); }} className="inline-flex items-center gap-1.5 text-sm" aria-label="Share">
          <Send className="h-5 w-5" />
          {shared ? 'Sent' : 'Share'}
        </button>
      </div>

      {composer && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addComment(post.id, draft);
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment"
            aria-label="Add a comment"
            className="h-10 flex-1 rounded-xl border border-[#E7E7EC] bg-[#FAFAFC] px-3 text-sm text-[#17171B] outline-none placeholder:text-[#9A9AA5] focus:border-[#C026D3]"
          />
          <button type="submit" className="text-sm font-semibold text-[#7C3AED]">
            Post
          </button>
        </form>
      )}

      {post.comments.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-[#6F6F7B]">
          {post.comments.slice(-3).map((comment, index) => (
            <li key={`${post.id}-${index}`}><span className="font-medium text-[#17171B]">You</span> {comment}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
