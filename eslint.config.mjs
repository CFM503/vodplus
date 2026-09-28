import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// eslint-config-next 仍为 eslintrc 格式，这里用 FlatCompat 桥接到 ESLint 9 flat config
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const config = [
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            'out/**',
            'build/**',
            'public/**',
            'next-env.d.ts',
            'coverage/**',
        ],
    },
    ...compat.extends('next/core-web-vitals', 'next/typescript'),
    {
        rules: {
            // 项目内已有大量 `catch (_)` / 未使用形参，避免一次性爆量噪音
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            // Next.js App Router 大量使用 props 解构，保持宽松
            'react/no-unknown-property': 'off',

            // 以下为存量风格问题，降级为 warning：它们不是运行时缺陷，
            // 而把 src/lib 与播放器 hooks 里的 `any` 一次性类型化属于大范围重构，
            // 与 AGENTS.md「只增不减、谨慎改动播放器」的原则冲突。逐步收紧。
            '@typescript-eslint/no-explicit-any': 'warn',
            'react/no-unescaped-entities': 'warn',
        },
    },
];

export default config;

