'use client';

import Link from 'next/link';
import { AudioLines } from 'lucide-react';
import { useFeed } from '@/components/tunemoment/feed';

const ACCENTS = [
  'linear-gradient(160deg, #7C3AED 0%, #EC4899 55%, #FB923C 100%)',
  'linear-gradient(160deg, #4F7CFF 0%, #7C3AED 50%, #C026D3 100%)',
  'linear-gradient(160deg, #22B8CF 0%, #7C3AED 45%, #EC4899 100%)',
];

export function ProfileView() {
  const { posts } = useFeed();
  const mine = posts.filter((post) => post.mine);
  const likes = mine.reduce((sum, post) => sum + post.likes, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex items-center gap-5">
        <span className="tm-gradient flex h-20 w-20 items-center justify-center rounded-full p-[3px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-[#17171B]">
            Y
          </span>
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">You</h1>
          <p className="text-sm text-[#6F6F7B]">@you</p>
          <p className="mt-1 text-sm text-[#17171B]">Turning moments into music.</p>
        </div>
      </header>

      <dl className="mt-6 flex gap-8 text-sm">
        <div>
          <dt className="text-[#9A9AA5]">Posts</dt>
          <dd className="text-lg font-semibold text-[#17171B]">{mine.length}</dd>
        </div>
        <div>
          <dt className="text-[#9A9AA5]">Likes</dt>
          <dd className="text-lg font-semibold text-[#17171B]">{likes}</dd>
        </div>
      </dl>

      {mine.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-[#DADAE2] bg-[#FAFAFC] px-6 py-14 text-center">
          <p className="text-sm text-[#6F6F7B]">Your published moments will show up here.</p>
          <Link href="/" className="tm-gradient mt-4 inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-white">
            Create
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {mine.map((post) => (
            <li key={post.id}>
              <Link href={`/explore#${post.id}`} className="group relative block overflow-hidden rounded-xl bg-[#F6F6F9]">
                {post.videoUrl ? (
                  <video
                    src={post.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full" style={{ background: ACCENTS[post.accent % ACCENTS.length] }} />
                )}
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-[#17171B] opacity-0 transition-opacity group-hover:opacity-100">
                  <AudioLines className="h-3 w-3 text-[#C026D3]" />
                  {post.soundtrack}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
