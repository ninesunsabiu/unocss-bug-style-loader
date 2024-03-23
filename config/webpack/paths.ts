import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import getPublicUrlOrPath from './getPublicUrlOrPath';

const appDirectory = fs.realpathSync(process.cwd());

const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

const envPublicUrl = process.env.PUBLIC_URL;

const publicUrl = envPublicUrl ?? "/";

function ensureSlash(inputPath: string, needsSlash: boolean) {
    const hasSlash = inputPath.endsWith('/');
    if (hasSlash && !needsSlash) {
        return inputPath.substr(0, inputPath.length - 1);
    } else if (!hasSlash && needsSlash) {
        return `${inputPath}/`;
    } else {
        return inputPath;
    }
}

function getServedPath() {
    const servedUrl = envPublicUrl ?? (publicUrl ? url.parse(publicUrl).pathname ?? './' : './');
    return ensureSlash(servedUrl, true);
}

const publicUrlOrPath = getPublicUrlOrPath(
    process.env.NODE_ENV === 'development',
    './',
    process.env.PUBLIC_URL
);

export default {
    src: resolveApp('src'),
    unocssConfig: resolveApp('uno.config.ts'),
    build: resolveApp('./dist'),
    public: resolveApp('public'),
    config: resolveApp('config'),
    appWebpackCache: resolveApp('node_modules/.cache'),
    appHtml: resolveApp('public/index.html'),
    appFavicon: resolveApp('public/favicon.ico'),
    publicUrl,
    servedPath: getServedPath(),
    appTsConfig: resolveApp('tsconfig.json'),
    publicUrlOrPath
};
