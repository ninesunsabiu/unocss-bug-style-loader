import * as path from 'path';
import type { Config } from '@swc/core';

export default function swcConfig({ isDev = false, needCoverage = false, shouldUseSourceMap = false }): Config {
    // swc polyfill 策略，会复用 babel 链路，但效率比 babel 低
    const polyfillConfig: Config = {
        env: {
            targets: require('./package.json').browserslist,
            mode: 'usage', // or entry
            coreJs: '3.32',
            path: path.resolve(__dirname)
        }
    };



    return {
        // 开发环境下，固定生成 sourceMap，方便调试
        // 生产环境下，根据配置决定是否生成 sourceMap
        sourceMaps: isDev || shouldUseSourceMap,
        module: {
            type: 'es6',
            ignoreDynamic: false
        },
        // polyfill
        ...polyfillConfig,
        jsc: {
            parser: {
                syntax: 'typescript',
                dynamicImport: true,
                decorators: true,
                tsx: true
            },
            loose: true,
            externalHelpers: true,
            transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
                react: {
                    runtime: 'automatic', // or classic
                    throwIfNamespace: true,
                    useBuiltins: true,
                    development: isDev
                }
            }
        }
    };
}
