const REACT_APP = /^REACT_APP_/i;

type Env = {
    NODE_ENV?: string;
    PUBLIC_URL?: string;
    WDS_SOCKET_HOST?: string;
    WDS_SOCKET_PATH?: string;
    WDS_SOCKET_PORT?: string;
    REACT_APP_COVERAGE?: string;
    REACT_APP_SOURCE_MAP?: string;
};

function getClientEnvironment(publicUrl: string) {
    const raw = Object.keys(process.env)
        .filter((key) => REACT_APP.test(key))
        .reduce<Env>(
            (env, key) => {
                env[key] = process.env[key];
                return env;
            },
            {
                NODE_ENV: process.env.NODE_ENV ?? 'development',
                PUBLIC_URL: publicUrl,
                WDS_SOCKET_HOST: process.env.WDS_SOCKET_HOST,
                WDS_SOCKET_PATH: process.env.WDS_SOCKET_PATH,
                WDS_SOCKET_PORT: process.env.WDS_SOCKET_PORT
            }
        );
    const stringified = {
        'process.env': Object.keys(raw).reduce((env, key) => {
            env[key] = JSON.stringify(raw[key]);
            return env;
        }, {})
    };

    return { raw, stringified };
}

export default getClientEnvironment;
