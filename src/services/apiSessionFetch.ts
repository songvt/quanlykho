const getSessionToken = () => {
    try {
        const raw = localStorage.getItem('qlkho_session');
        return raw ? JSON.parse(raw).sessionToken as string | undefined : undefined;
    } catch {
        return undefined;
    }
};

export const installApiSessionFetch = () => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const target = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
        const url = new URL(target, window.location.origin);
        const token = getSessionToken();
        if (!token || url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, init);

        const headers = new Headers(init.headers);
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        return nativeFetch(input, { ...init, headers });
    };
};
