const DB_NAME = 'warehouse-image-upload-queue';
const STORE_NAME = 'jobs';
const EVENT_NAME = 'image-upload-queue';

export type QueuedImage = {
    id: string;
    rowNumber: number;
    installerName: string;
    imageType: 'before' | 'after' | 'appointment';
    file: File;
    createdAt: number;
    attempts: number;
    nextAttemptAt: number;
};

let processing = false;
let retryTimer: number | null = null;

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

async function readJobs(): Promise<QueuedImage[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = () => { db.close(); resolve(request.result as QueuedImage[]); };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

async function putJob(job: QueuedImage) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(job);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
}

async function deleteJob(id: string) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(id);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
}

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không thể đọc ảnh chờ đồng bộ.'));
    reader.readAsDataURL(file);
});

const notify = (detail: Record<string, unknown>) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));

export async function enqueueImageUpload(job: Omit<QueuedImage, 'id' | 'createdAt' | 'attempts' | 'nextAttemptAt'>) {
    const queued: QueuedImage = { ...job, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0, nextAttemptAt: Date.now() };
    await putJob(queued);
    notify({ type: 'queued', rowNumber: queued.rowNumber, imageType: queued.imageType });
    void processImageUploadQueue();
}

export async function processImageUploadQueue() {
    if (processing || !navigator.onLine) return;
    processing = true;
    try {
        const jobs = (await readJobs()).sort((a, b) => a.createdAt - b.createdAt);
        const processed = new Set<string>();
        for (const job of jobs) {
            if (processed.has(job.id)) continue;
            if (!navigator.onLine) break;
            if (job.nextAttemptAt > Date.now()) {
                scheduleRetry(job.nextAttemptAt - Date.now());
                continue;
            }
            // Gộp ảnh cùng một biên bản thành một lượt gửi: nhanh hơn trên 4G và
            // tránh nhiều lần đọc/ghi Google Sheet cho Ảnh trước, Ảnh sau, BB hẹn.
            const group = jobs.filter((candidate) => candidate.rowNumber === job.rowNumber
                && candidate.installerName === job.installerName
                && !processed.has(candidate.id)
                && candidate.nextAttemptAt <= Date.now()).slice(0, 3);
            if (!group.length) continue;
            group.forEach((item) => notify({ type: 'uploading', rowNumber: item.rowNumber, imageType: item.imageType }));
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 55_000);
            try {
                const response = await fetch('/api/image-control', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
                    body: JSON.stringify({
                        rowNumber: job.rowNumber,
                        installerName: job.installerName,
                        files: await Promise.all(group.map(async (item) => ({
                            imageType: item.imageType, fileName: item.file.name, mimeType: item.file.type, fileData: await toBase64(item.file),
                        }))),
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Không thể lưu ảnh lên Drive.');
                await Promise.all(group.map((item) => deleteJob(item.id)));
                group.forEach((item) => processed.add(item.id));
                notify({ type: 'success', rowNumber: job.rowNumber, imageType: job.imageType, files: data.files || [] });
            } catch (error: any) {
                const attempts = Math.max(...group.map((item) => item.attempts)) + 1;
                const delay = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(attempts, 6));
                await Promise.all(group.map((item) => putJob({ ...item, attempts: item.attempts + 1, nextAttemptAt: Date.now() + delay })));
                notify({ type: 'retrying', rowNumber: job.rowNumber, imageType: job.imageType, message: error?.message, delay });
                scheduleRetry(delay);
                break;
            } finally { window.clearTimeout(timeout); }
        }
    } finally { processing = false; }
}

function scheduleRetry(delay: number) {
    if (retryTimer !== null) return;
    retryTimer = window.setTimeout(() => { retryTimer = null; void processImageUploadQueue(); }, delay);
}

export const imageUploadQueueEvent = EVENT_NAME;
