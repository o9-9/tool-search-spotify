import crypto from 'node:crypto';

import type {
    AlbumUnion,
    Artist,
    SearchV2,
    PathfinderSearchResponse,
    PathfinderArtistOverviewResponse,
    PathfinderGetAlbumResponse,
    PathfinderHomeResponse,
    HomeSection
} from './spotify.ts';

interface Variables {
    buildVer: string;
    buildDate: string;
    clientVersion: string;
    serverTime: string;
}

interface SecretBytes {
    version: number;
    secret: number[];
}

interface AccessToken {
    clientId: string;
    accessToken: string;
    accessTokenExpirationTimestampMs: number;
}

interface ClientToken {
    token: string;
    refreshAt: number;
}

interface GrantedToken {
    token: string;
    [key: string]: unknown;
}

interface SearchOptions {
    offset?: number;
    limit?: number;
    numberOfTopResults?: number;
    includeAudiobooks?: boolean;
    includeArtistHasConcertsField?: boolean;
    includePreReleases?: boolean;
    includeLocalConcertsField?: boolean;
    includeAuthors?: boolean;
    [key: string]: unknown;
}

const postJSON = async <T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> => {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    });
    return res.json() as Promise<T>;
};

class Spotify {
    $latestSecret: SecretBytes = { version: 1, secret: [] };
    deviceId = '';

    cookie = '';
    customUserAgent = '';

    accessToken: AccessToken = { clientId: '', accessToken: '', accessTokenExpirationTimestampMs: 0 };
    clientToken: ClientToken = { token: '', refreshAt: 0 };

    variables?: Variables;

    constructor() {
        this.$fetchSecrets();
        setInterval(() => this.$fetchSecrets(), 1000 * 60 * 60 * 1).unref();
    }

    async $fetchSecrets(): Promise<void> {
        const req = await fetch('https://raw.githubusercontent.com/VillainsRule/searchtify/master/secrets/secretBytes.json');
        const bytes: SecretBytes[] = await req.json() as any;

        this.$latestSecret = bytes[bytes.length - 1];

        if (!this.$latestSecret) {
            console.error('spotify patched searchtify yet again. here\'s how to fix:');
            console.error('1. ensure you have the latest version of searchtify installed');
            console.error('2. open an issue @ https://github.com/VillainsRule/searchtify');
            console.error('3. make sure to specify "error code 3" in the issue');
            process.exit(1);
        }
    }

    setUserAgent(userAgent: string): void {
        this.customUserAgent = userAgent;
    }

    async getVariables(): Promise<Variables> {
        const mainReq = await fetch('https://open.spotify.com', {
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'user-agent': this.customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
            }
        });

        const mainPage = await mainReq.text();

        const deviceId = mainReq.headers.getSetCookie().find(h => h.startsWith('sp_t='))?.split(';')[0].split('=')[1];
        if (!deviceId) throw new Error('[searchtify] library broke. open an issue on Github with error code 210.');

        this.deviceId = deviceId;

        const mainScript = mainPage.match(/<\/script><script src="(.*?)"/)?.[1];
        if (!mainScript) throw new Error('[searchtify] library broke. open an issue on Github with error code 293.');

        const scriptContent = await (await fetch(mainScript)).text();

        this.variables = {
            buildVer: 'unknown',
            buildDate: 'unknown',
            clientVersion: scriptContent.match(/clientVersion:"(.*?)"/)?.[1] || '',
            serverTime: mainReq.headers.get('x-timer')?.match(/S([0-9]+)\./)?.[1] || ''
        };

        return this.variables;
    }

    toSecret(input: number[]): Buffer {
        const inputBytes = [...Buffer.from(input)];
        const transformed = inputBytes.map((e, t) => e ^ ((t % 33) + 9));
        const joined = transformed.map(num => num.toString()).join('');
        const hex_str = Buffer.from(joined).toString('hex');
        return Buffer.from(hex_str, 'hex');
    }

    generateTOTP(timestamp = Date.now()): string {
        const totpSecret = this.$latestSecret ? this.toSecret(this.$latestSecret.secret) : null;
        if (!totpSecret) {
            console.error('spotify patched searchtify yet again. here\'s how to fix:');
            console.error('1. ensure you have the latest version of searchtify installed');
            console.error('2. open an issue @ https://github.com/VillainsRule/searchtify');
            console.error('3. make sure to specify "error code 2" in the issue');
            process.exit(1);
        }

        const secretBuffer = Buffer.from(totpSecret);

        const digits = 6;
        const timeStep = 30;
        const time = Math.floor(timestamp / 1000 / timeStep);

        const counter = Buffer.alloc(8);
        counter.writeBigUInt64BE(BigInt(time));

        const hmac = crypto.createHmac('sha1', secretBuffer).update(counter).digest();
        const offset = hmac[hmac.length - 1] & 0xf;

        const code = (
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)
        ) % 10 ** digits;

        return code.toString().padStart(digits, '0');
    }

    async pullAccessToken(): Promise<void> {
        if (!this.variables) await this.getVariables();

        const urlBase = new URL('https://open.spotify.com/api/token');
        const params = new URLSearchParams();
        const totp = this.generateTOTP();

        params.append('reason', 'init');
        params.append('productType', 'web-player');
        params.append('totp', totp);
        params.append('totpServer', totp);
        params.append('totpVer', this.$latestSecret.version.toString());

        urlBase.search = params.toString();

        const req = await fetch(urlBase, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });

        const res = await req.json() as { error?: string } & AccessToken;

        if (res.error) {
            console.error('spotify patched searchtify yet again. here\'s how to fix:');
            console.error('1. ensure you have the latest version of searchtify installed');
            console.error('2. open an issue @ https://github.com/VillainsRule/searchtify');
            console.error('3. make sure to specify "error code 1" in the issue');
            console.log(res);
            process.exit(1);
        }

        this.accessToken = res;
    }

    async pullClientToken(): Promise<void> {
        if (!this.variables) await this.getVariables();

        const data = await postJSON<{ granted_token: GrantedToken }>(
            'https://clienttoken.spotify.com/v1/clienttoken',
            {
                client_data: {
                    client_version: this.variables!.clientVersion,
                    client_id: this.accessToken.clientId,
                    js_sdk_data: {
                        device_brand: 'Apple',
                        device_model: 'unknown',
                        os: 'macos',
                        os_version: '10.15.7',
                        device_id: this.deviceId,
                        device_type: 'computer'
                    }
                }
            }
        );

        this.clientToken = {
            ...data.granted_token,
            token: data.granted_token.token,
            refreshAt: Date.now() + 1209600
        };
    }

    async getHeaders(): Promise<Record<string, string>> {
        if (!this.accessToken.accessToken) await this.pullAccessToken();

        if (this.accessToken.accessTokenExpirationTimestampMs - Date.now() <= 1) await this.pullAccessToken();

        return {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en',
            'App-Platform': 'WebPlayer',
            'Authorization': `Bearer ${this.accessToken.accessToken}`,
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json;charset=UTF-8',
            'Origin': 'https://open.spotify.com',
            'Referer': 'https://open.spotify.com/',
            'Spotify-App-Version': this.variables!.clientVersion,
            'User-Agent': this.customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
        };
    }

    async search(query: string, opts: SearchOptions = {}): Promise<SearchV2> {
        const data = await postJSON<PathfinderSearchResponse>(
            'https://api-partner.spotify.com/pathfinder/v2/query',
            {
                operationName: 'searchDesktop',
                variables: {
                    ...opts,
                    searchTerm: query,
                    offset: opts.offset ?? 0,
                    limit: opts.limit ?? 10,
                    numberOfTopResults: opts.numberOfTopResults ?? 5,
                    includeAudiobooks: opts.includeAudiobooks ?? false,
                    includeArtistHasConcertsField: opts.includeArtistHasConcertsField ?? true,
                    includePreReleases: opts.includePreReleases ?? true,
                    includeLocalConcertsField: opts.includeLocalConcertsField ?? false,
                    includeAuthors: opts.includeAuthors ?? true
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: 'd9f785900f0710b31c07818d617f4f7600c1e21217e80f5b043d1e78d74e6026'
                    }
                }
            },
            await this.getHeaders()
        );

        return data.data.searchV2;
    }

    async getPopular(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): Promise<HomeSection[]> {
        const data = await postJSON<PathfinderHomeResponse>(
            'https://api-partner.spotify.com/pathfinder/v2/query',
            {
                operationName: 'home',
                variables: {
                    timeZone: timezone,
                    sp_t: this.deviceId,
                    facet: '',
                    sectionItemsLimit: 10
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '72325e84c876c72564fb9ab012f602be8ef6a1fdd3039be2f8b4f2be4c229a30'
                    }
                }
            },
            await this.getHeaders()
        );

        return data.data.home.sectionContainer.sections.items;
    }

    async getAlbum(uri: string): Promise<AlbumUnion> {
        const data = await postJSON<PathfinderGetAlbumResponse>(
            'https://api-partner.spotify.com/pathfinder/v2/query',
            {
                operationName: 'getAlbum',
                variables: {
                    uri,
                    locale: '',
                    offset: 0,
                    limit: 50
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '97dd13a1f28c80d66115a13697a7ffd94fe3bebdb94da42159456e1d82bfee76'
                    }
                }
            },
            await this.getHeaders()
        );

        return data.data.albumUnion;
    }

    async getArtist(uri: string): Promise<Artist> {
        const data = await postJSON<PathfinderArtistOverviewResponse>(
            'https://api-partner.spotify.com/pathfinder/v2/query',
            {
                operationName: 'queryArtistOverview',
                variables: {
                    uri,
                    locale: ''
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '1ac33ddab5d39a3a9c27802774e6d78b9405cc188c6f75aed007df2a32737c72'
                    }
                }
            },
            await this.getHeaders()
        );

        return data.data.artistUnion;
    }
}

export default Spotify;