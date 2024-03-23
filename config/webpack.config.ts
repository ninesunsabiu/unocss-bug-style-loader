/* eslint-disable import/no-extraneous-dependencies */
import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import Unocss from '@unocss/webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import swcConfig from '../.swcrc';
import devServer from './webpackDevServer.config';
import getClientEnvironment from './webpack/env';
import paths from './webpack/paths';
import createEnvironmentHash from './webpack/persistentCache/createEnvironmentHash';
import type { JsMinifyOptions as SwcOptions } from '@swc/core';



const env = getClientEnvironment(paths.servedPath);

const isEnvDevelopment = env.raw.NODE_ENV === 'development';
const isEnvProduction = env.raw.NODE_ENV === 'production';

const timestamp = new Date()
    .toISOString()
    .replace(/\.[\w\W]+?$/, '')
    .replace(/:|\s|T/g, '')
    .replace(/-/g, '');

const stamp = isEnvProduction ? `.${timestamp}` : '';

const needCoverage = env.raw.REACT_APP_COVERAGE === 'on';


// 如果开启了 sentry，那么也是需要 source map 的；
const shouldUseSourceMap = env.raw.REACT_APP_SOURCE_MAP === 'on';

const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;

type LoaderOption = NonNullable<Exclude<webpack.RuleSetUseItem, Function | string>>['options'];

const getScriptLoader = (): webpack.RuleSetUseItem => {
    return needCoverage
        ? {
              loader: 'babel-loader',
              options: {
                  cacheDirectory: true
              }
          }
        : {
              loader: 'swc-loader',
              options: swcConfig({
                  isDev: isEnvDevelopment,
                  needCoverage,
                  shouldUseSourceMap
              })
          };
};

const getStyleLoaders = (cssOptions?: LoaderOption, preProcessor?: string) => {
    const loaders: webpack.RuleSetUseItem[] = [
        {
            loader: 'css-loader',
            options: cssOptions
        }
    ];

    if (isEnvDevelopment) {
        loaders.unshift({
            loader: 'style-loader'
        });
    } else {
        loaders.unshift({
            loader: MiniCssExtractPlugin.loader
        });
    }

    if (preProcessor) {
        loaders.push({
            loader: require.resolve(preProcessor),
            options: {
                sourceMap: true
            }
        });
    }

    return loaders;
};

const config: webpack.Configuration = {
    // 打包失败时立即停止；
    bail: isEnvProduction,
    target: isEnvProduction ? 'browserslist' : 'web',
    mode: isEnvProduction ? 'production' : 'development',
    entry: './src/index.tsx',
    output: {
        path: paths.build,
        filename: `static/js/[name]${stamp}.js`,
        chunkFilename: `static/js/[name]${stamp}.js`,
        publicPath: paths.publicUrl,
        /**
         * 以下三个配置是给 qiankun 微前端专用的配置，勿删！！！
         */
        library: {
            type: 'umd', // 当 minify 引擎使用的是 ESBuild 时， 如果 format 设为 iife，这里需要设置为 window 做下绕过，否则 webpack 暴露出全局的变量将不会被微前段基座加载到
            name: 'zhiwei'
        },
        libraryTarget: 'umd', // 跟 library 保持一致
        chunkLoadingGlobal: `webpackJsonp_zhiwei`
    },
    devtool: isEnvDevelopment ? 'eval-cheap-module-source-map' : shouldUseSourceMap ? 'source-map' : false,
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json', '.jsx'],
        fallback: {
            // Bug: Cannot import 'react/jsx-runtime' from esm node/webpack 5
            // https://github.com/facebook/react/issues/20235
            'react/jsx-runtime': 'react/jsx-runtime.js',
            'react/jsx-dev-runtime': 'react/jsx-dev-runtime.js'
        }
    },
    optimization: {
        realContentHash: true,
        chunkIds: isEnvProduction ? 'deterministic' : 'named',
        minimize: isEnvProduction,
        minimizer: [
            // 这里为了保证 output#library 的配置生效且制品符合预期，这里不能使用 ESBuild 的 minify，
            // ESBuild 的 minify 会将代码中的一些模块全局变量提升为 window 全局变量，会可能出现多实例冲突的问题
            new TerserPlugin<SwcOptions>({
                minify: TerserPlugin.swcMinify,
                terserOptions: {
                    compress: isEnvProduction
                }
            }),
            new CssMinimizerPlugin()
        ],
        ...(isEnvProduction
            ? {
                  // 将未被使用的 export 从 bundle 中删除（需 minimize 为 true）
                  usedExports: true,
                  splitChunks: {
                      chunks: 'async',
                      maxInitialRequests: Number.MAX_SAFE_INTEGER,
                      maxAsyncRequests: Number.MAX_SAFE_INTEGER,
                      cacheGroups: {
                          defaultVendors: false,
                          default: false,
                          framework: {
                              idHint: 'framework',
                              //   名字相同的 cacheGroup 会被合并到同一个 chunk 文件
                              name: 'framework',
                              chunks: 'all',
                              test: /[\\/]node_modules[\\/](react|react-dom|redux|react-redux|redux-saga|react-router|react-router-dom|@reduxjs[\\/]toolkit)[\\/]/,
                              enforce: true,
                              enforceSizeThreshold: 0,
                              minChunks: 1,
                              minSize: 0,
                              priority: 20
                          },
                          polyfill: {
                              idHint: 'polyfill',
                              //   名字相同的 cacheGroup 会被合并到同一个 chunk 文件
                              name: 'polyfill',
                              chunks: 'all',
                              test: /[\\/]node_modules[\\/](core-js|babel-runtime|@babel[\\/]runtime(.*))[\\/]/,
                              enforce: true,
                              enforceSizeThreshold: 0,
                              minChunks: 1,
                              minSize: 0,
                              priority: 19
                          },
                          'tool-funcs': {
                              idHint: 'tool-funcs',
                              name: 'common-func',
                              chunks: 'all',
                              test: /[\\/]node_modules[\\/](fp-ts|io-ts|ramda)[\\/]/,
                              enforce: true,
                              enforceSizeThreshold: 150 * 1000,
                              minSizeReduction: 150 * 1000,
                              reuseExistingChunk: true,
                              minChunks: 2,
                              minSize: 150 * 1000,
                              priority: 10
                          },
                          vendors: {
                              idHint: 'vendors',
                              chunks: 'all',
                              test: /[\\/]node_modules[\\/]/,
                              // 创建出来的 chunk 最小为 150KB
                              minSize: 150 * 1000,
                              // 提取到新的 chunk 之后至少能减少原 chunk 150KB 的大小
                              minSizeReduction: 150 * 1000,
                              minChunks: 2,
                              // 复用已经存在的 chunk
                              reuseExistingChunk: true,
                              priority: -10
                          }
                      }
                  }
              }
            : {})
    },
    module: {
        rules: [
            {
                oneOf: [
                    {
                        test: /\.worker\.(j|t)s$/,
                        use: [
                            {
                                loader: 'worker-loader',
                                options: { inline: 'fallback' }
                            },
                            getScriptLoader()
                        ]
                    },
                    // linguijs 国际化 loader  用于使用 import *.po 路径
                    { test: /\.po/, use: [{ loader: '@lingui/loader' }] },
                    // 针对工程编译涉及到的所有 ts 文件（除单测文件），均要处理
                    {
                        test: /^(?!.*spec\.ts$)(?!.*test\.ts$).*\.(ts|tsx|jsx)$/,
                        use: getScriptLoader()
                    },
                    // 针对 js 文件，不再二次处理 node_modules 中的包
                    {
                        test: /\.js$/,
                        include: paths.src,
                        exclude: [
                            /src[\\/]libs[\\/]js/,
                            /src\/modules\/pages\/SystemManagement\/MenuSetting\/MenuTree\/theme/,
                            /public/,
                            /node_modules/
                        ],
                        use: getScriptLoader()
                    },
                    // 这里是针对一些 node_modules 中的包，需要二次处理的 js 文件
                    // 防止语法太新，不兼容低版本浏览器
                    ...(isEnvProduction
                        ? [
                              {
                                  test: /\.(m?)js$/,
                                  include: [
                                      /node_modules[\\/]crypto-es/,
                                      /node_modules[\\/]@tanstack/,
                                      /node_modules[\\/]react-virtuoso/,
                                      // 针对引用 Monorepo 内子包模块的二次处理，补充目标制品语法的 Polyfills
                                      /(.*)([\\/]packages[\\/](.*)[\\/]dist[\\/]).*/
                                  ],
                                  exclude: [paths.src, paths.public, paths.config],
                                  use: {
                                      loader: 'babel-loader',
                                      options: {
                                          cacheDirectory: true
                                      }
                                  }
                              }
                          ]
                        : []),
                    {
                        test: cssRegex,
                        exclude: cssModuleRegex,
                        use: getStyleLoaders({
                            importLoaders: 2,
                            sourceMap: true,
                            modules: {
                                mode: 'icss'
                            }
                        }),
                        sideEffects: true
                    },
                    {
                        test: cssModuleRegex,
                        sideEffects: true,
                        use: getStyleLoaders({
                            importLoaders: 2,
                            sourceMap: true,
                            modules: {
                                mode: 'local',
                            }
                        })
                    },
                    {
                        test: /\.svg$/i,
                        issuer: {
                            // 限制该 loader
                            and: [/\.(ts|tsx|js|jsx|md|mdx)$/]
                        },
                        resourceQuery: { not: [/url/] }, // exclude react component if *.svg?url
                        use: [
                            {
                                loader: '@svgr/webpack',
                                options: {
                                    prettier: false,
                                    svgo: false,
                                    svgoConfig: {
                                        plugins: [{ removeViewBox: false }]
                                    },
                                    titleProp: true,
                                    ref: true
                                }
                            }
                        ]
                    },
                    {
                        test: /\.svg$/i,
                        type: 'asset',
                        resourceQuery: /url/ // *.svg?url
                    },
                    /**
                     * 以下图片直接不处理处到 static/images：
                     * 1. 移动端 二维码 下载引导图；
                     */
                    {
                        test: [/appdownload\.png$/],
                        type: 'asset/resource',
                        generator: {
                            filename: 'static/images/[name][ext]'
                        }
                    },
                    {
                        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.ico$/],
                        type: 'asset',
                        generator: {
                            filename: `static/images/[name]${stamp}[ext]`
                        },
                        parser: {
                            dataUrlCondition: {
                                // 将小于 10000 字节的图片认定为小图片
                                maxSize: 10000
                            }
                        }
                    },
                    // 将图标字体文件存放到 media/font 路径下
                    {
                        test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
                        type: 'asset',
                        generator: {
                            filename: `static/media/fonts/[hash]${stamp}[ext]`
                        },
                        parser: {
                            dataUrlCondition: {
                                // 我们目前打出来的资源并没有利用缓存，所以直接
                                // 将字体库 base64 编码进代码中，避免微前端下资源路径出错：
                                // 设置一个比所有字体库文件大小还大的值（10MB）来让所有字体资源
                                // 都以 base64 形式打包
                                maxSize: 10 * 1024 * 1024
                            }
                        }
                    },
                    // 必须放在最后一项，保证不被其他 loader 匹配到的资源文件能被打包；
                    {
                        type: 'asset/resource',
                        exclude: [/\.(js|mjs|jsx)$/, /\.html$/, /\.json$/],
                        generator: {
                            filename: `static/media/[hash]${stamp}[ext]`
                        }
                    }
                    // PS：不能在下面继续添加 loader，要添加必须放到上面的 asset/resource 之前；
                ]
            }
        ]
    },
    plugins: [
        Unocss({
            configFile: paths.unocssConfig
        }),
        new webpack.DefinePlugin(env.stringified),
        new HtmlWebpackPlugin({
            title: "test-unocss",
            inject: 'body',
            template: paths.appHtml,
            ...(isEnvProduction
                ? {
                      minify: {
                          removeComments: true,
                          collapseWhitespace: true,
                          removeRedundantAttributes: true,
                          useShortDoctype: true,
                          removeEmptyAttributes: true,
                          removeStyleLinkTypeAttributes: true,
                          keepClosingSlash: true,
                          minifyJS: true,
                          minifyCSS: true,
                          minifyURLs: true
                      }
                  }
                : undefined)
        }),
        ...(isEnvDevelopment ? [new ReactRefreshWebpackPlugin()] : []),
        ...(isEnvProduction
            ? [
                  new MiniCssExtractPlugin({
                      filename: `static/css/[name]${stamp}.css`,
                      chunkFilename: `static/css/[name]${stamp}.css`
                  })
              ]
            : [])
    ],
    ...(isEnvDevelopment ? { devServer } : {})
};

export default config;
