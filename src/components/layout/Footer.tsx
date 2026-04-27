import { cn } from "@/lib/utils";

export function Footer({ className }: { className?: string }) {
    const version = process.env.NEXT_PUBLIC_VERSION;
    const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER;
    const commitId = process.env.NEXT_PUBLIC_COMMIT_ID;

    if (!version && !commitId) return null;

    const display = [
        version && `v${version}`,
        buildNumber && buildNumber !== '0' && `b${buildNumber}`,
        commitId && commitId,
    ].filter(Boolean).join(' · ');

    return (
        <footer className={cn("py-6 text-center", className)}>
            <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-mono text-white/20 select-none hover:text-white/40 hover:bg-white/10 hover:border-white/10 transition-all cursor-default">
                {display}
            </div>
        </footer>
    );
}
