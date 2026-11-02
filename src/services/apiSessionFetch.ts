export const isSessionTokenExpired = (token: string | undefined): boolean => {
    // Node/Vite proxies commonly limit request headers to 8–16 KB.  A legacy
    // session containing a profile signature must be discarded before it is
    // sent again, otherwise every API call receives HTTP 431.
    if (!token || token.length > 4_096) return true;
    try {
        const [payload] = token.split('.');
        if (!payload) return true;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = typeof atob === 'function'
            ? atob(normalized)
            : Buffer.from(normalized, 'base64').toString('utf8');
        const data = JSON.parse(json);
        if (!data.exp || typeof data.exp !== 'number' || data.exp <= Math.floor(Date.now() / 1000)) {
            return true;
        }
        return false;
    } catch {
        return true;
    }
};

export const getSessionToken = () => {
    try {
        const raw = localStorage.getItem('qlkho_session');
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        const token = parsed?.sessionToken as string | undefined;
        if (!token || isSessionTokenExpired(token)) {
            return undefined;
        }
        return token;
    } catch {
        return undefined;
    }
};

export const installApiSessionFetch = () => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const target = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
        const url = new URL(target, window.location.origin);
        const token = getSessionToken();
        const isSameOriginApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');

        const headers = new Headers(init.headers);
        if (isSameOriginApi && token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await nativeFetch(input, { ...init, headers });

        if (response.status === 401 && isSameOriginApi && !url.pathname.includes('login')) {
            try {
                localStorage.removeItem('qlkho_session');
                window.dispatchEvent(new CustomEvent('auth:expired'));
            } catch {}
        }

        return response;
    };
};
