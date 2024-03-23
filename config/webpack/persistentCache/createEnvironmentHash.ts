import { createHash } from 'crypto';

export default function createEnvironmentHash(env: Record<string, string | undefined>) {
    const hash = createHash('md5');
    hash.update(JSON.stringify(env));

    return hash.digest('hex');
}
