"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const VideoPlayer = dynamic(
  () => import('@/components/VideoPlayer').then((mod) => mod.default),
  {
    loading: () => (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

interface Episode {
  url: string;
  title: string;
}

interface ClientPlayerWrapperProps {
  episodes: Episode[];
  poster: string;
  title?: string;
  onEnded?: () => void;
  autoplay?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  nextEpisodeUrl?: string;
}

export default function ClientPlayerWrapper({
  episodes,
  poster,
  title,
  onEnded,
  autoplay = false,
  onPrevEpisode,
  onNextEpisode,
  hasPrevEpisode = false,
  hasNextEpisode = false,
  nextEpisodeUrl,
}: ClientPlayerWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full">
      {isVisible ? (
        <VideoPlayer
          url={episodes[0]?.url || ''}
          poster={poster}
          title={title}
          onEnded={onEnded}
          autoplay={autoplay}
          onPrevEpisode={onPrevEpisode}
          onNextEpisode={onNextEpisode}
          hasPrevEpisode={hasPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          nextEpisodeUrl={nextEpisodeUrl}
        />
      ) : (
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
          {poster && (
            <div className="absolute inset-0">
              <img
                src={poster}
                alt={title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setIsVisible(true)}
              className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg"
            >
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
