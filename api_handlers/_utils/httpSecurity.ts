import type { IncomingHttpHeaders } from 'node:http';

type HeaderResponse = { setHeader(name: string, value: string): void };
type CronRequest = { headers: IncomingHttpHeaders };

const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const defaultProductionOrigins = ['https://quanlykhobsg.vercel.app'];

export const isProduction = (environment: NodeJS.ProcessEnv = process.env) =>
    environment.VERCEL_ENV === 'production' || environment.NODE_ENV === 'production';

export const isCorsOriginAllowed = (origin: string | undefined, environment: NodeJS.ProcessEnv = process.env) => {
    // Requests without Origin are same-origin navigations, health checks, or scheduled jobs.
    if (!origin) return true;

    const configuredOrigins = (environment.CORS_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    if (configuredOrigins.includes(origin) || defaultProductionOrigins.includes(origin)) return true;
    return !isProduction(environment) && localOrigin.test(origin);
};

export const applySecurityHeaders = (response: HeaderResponse) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
};

export const getCronAuthorizationError = (request: CronRequest, environment: NodeJS.ProcessEnv = process.env) => {
    // Local development keeps the existing scheduler working without requiring secrets.
    if (!isProduction(environment)) return null;

    const secret = environment.CRON_SECRET;
    if (!secret) return { status: 503, error: 'CRON_SECRET is not configured' };
    if (request.headers.authorization !== `Bearer ${secret}`) return { status: 401, error: 'Unauthorized cron invocation' };
    return null;
};
