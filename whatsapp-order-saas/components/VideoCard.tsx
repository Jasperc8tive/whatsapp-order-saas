'use client';

import Link from 'next/link';
import Image from 'next/image';

interface VideoCardProps {
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  thumbnailUrl?: string;
  topics?: string[];
}

export default function VideoCard({
  title,
  description,
  duration,
  videoUrl,
  thumbnailUrl,
  topics = [],
}: VideoCardProps) {
  return (
    <Link href={videoUrl} target="_blank" rel="noopener noreferrer">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer h-full flex flex-col">
        {/* Thumbnail */}
        <div className="relative bg-gray-900 aspect-video flex items-center justify-center overflow-hidden group">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800" />
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            {/* Play icon SVG */}
            <svg
              className="w-12 h-12 text-white drop-shadow-lg"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold text-white">
            {duration}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{title}</h3>
          <p className="text-xs text-gray-600 mt-2 flex-1">{description}</p>

          {/* Topics */}
          {topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 inline-flex items-center text-xs font-semibold text-blue-700">
            Watch on YouTube →
          </div>
        </div>
      </div>
    </Link>
  );
}
