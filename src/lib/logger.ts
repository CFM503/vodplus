export const logger = {
    info: (ctx: string, ...args: unknown[]) => console.info(`[${ctx}]`, ...args),
    warn: (ctx: string, ...args: unknown[]) => console.warn(`[${ctx}]`, ...args),
    error: (ctx: string, ...args: unknown[]) => console.error(`[${ctx}]`, ...args),
};
