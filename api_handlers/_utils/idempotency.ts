export function getIdempotencyKey(headers: Record<string, string | string[] | undefined>, body: unknown): string {
    const fromHeader = headers['idempotency-key'];
    const headerValue = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
    if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();

    const fromBody = body && typeof body === 'object' ? (body as { idempotencyKey?: unknown }).idempotencyKey : undefined;
    return typeof fromBody === 'string' ? fromBody.trim() : '';
}
