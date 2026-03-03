import React from 'react';

interface HomeSkeletonProps {
    title?: string;
}

export function HomeSkeleton({ title }: HomeSkeletonProps) {
    return (
        <section className='space-y-6 animate-pulse'>
            <div className='flex items-center gap-4'>
                <div className='w-1.5 h-8 bg-slate-700 rounded-full' />
                <div className='h-7 bg-slate-700 rounded-lg w-48' />
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6'>
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className='space-y-3'>
                        <div className='aspect-[2/3] bg-slate-800/60 rounded-xl w-full' />
                        <div className='space-y-2'>
                            <div className='h-4 bg-slate-800/60 rounded w-3/4' />
                            <div className='h-3 bg-slate-800/60 rounded w-1/2' />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
