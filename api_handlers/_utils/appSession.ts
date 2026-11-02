import crypto from 'node:crypto';

export type AppSession = {
    id: string;
    email: string;
    role?: string;
    permissions?: unknown;
};

type SignedSession = AppSession & { exp: number };

const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const signatureFor = (payload: string, secret: string) =>
    crypto.createHmac('sha256', secret).update(payload).digest('base64url');

export const createAppSession = (session: AppSession, secret: string, lifetimeSeconds = 12 * 60 * 60) => {
    // JWT is sent in every Authorization header.  Never serialize the full
    // employee record here: fields such as signature_data can be tens of KB
    // and make every API request fail with HTTP 431.
    const compactSession: AppSession = {
        id: session.id,
        email: session.email,
        ...(session.role ? { role: session.role } : {}),
        ...(session.permissions !== undefined ? { permissions: session.permissions } : {}),
    };
    const payload = encode(JSON.stringify({ ...compactSession, exp: Math.floor(Date.now() / 1000) + lifetimeSeconds }));
    return `${payload}.${signatureFor(payload, secret)}`;
};

export const verifyAppSession = (token: string | undefined, secret: string): AppSession | null => {
    if (!token) return null;
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length > 0) return null;

    const expected = signatureFor(payload, secret);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

    try {
        const parsed = JSON.parse(decode(payload)) as SignedSession;
        if (!parsed.id || !parsed.email || !Number.isFinite(parsed.exp) || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
        const { exp: _exp, ...session } = parsed;
        return session;
    } catch {
        return null;
    }
};

export const readBearerSession = (authorization: string | undefined, secret: string) => {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
    return verifyAppSession(token, secret);
};
