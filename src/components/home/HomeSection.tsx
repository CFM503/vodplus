import { Movie } from '@/types';
import { MovieCard } from '@/components/MovieCard';

interface HomeSectionProps {
    title: string;
    list: Movie[];
    link?: string;
    iconColor?: string;
}

export function HomeSection({ title, list, link = '#', iconColor = 'indigo' }: HomeSectionProps) {
    if (!list || list.length === 0) return null;

    return (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                    <span className={`w-1.5 h-8 bg-gradient-to-b from-${iconColor}-500 to-cyan-400 rounded-full mr-4 shadow-[0_0_10px_rgba(99,102,241,0.5)]`}></span>
                    {title}
                </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {list.map((movie: Movie, index: number) => (
                    <MovieCard key={movie.vod_id} movie={movie} index={index} />
                ))}
            </div>
        </section>
    );
}
