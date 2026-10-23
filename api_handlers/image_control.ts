import { VercelRequest, VercelResponse } from '@vercel/node';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
import { uploadToGoogleDrive } from './_utils/googleDrive.js';

const SHEET_ID = process.env.IMAGE_CONTROL_SHEET_ID || '12VDGmHBjUzC_28iLOUOhRnbJYuyYp-X1-pmP-uTW3XU';
const SHEET_NAME = process.env.IMAGE_CONTROL_SHEET_NAME || 'PT_MOI';
const DRIVE_FOLDER_ID = process.env.IMAGE_CONTROL_DRIVE_FOLDER_ID || '1RWEy2Rkh6TzlcRTHNLqRuicBBbLdflC6';
const CACHE_MS = 5 * 60 * 1000;

type ImageType = 'before' | 'after' | 'appointment';
type IndexRow = {
    rowNumber: number;
    key: string;
    requestType: string;
    service: string;
    account: string;
    customer: string;
    address: string;
    completedAt: string;
    installer: string;
    appointmentTick: string;
    check: string;
    images: Record<ImageType, string>;
    links: Record<ImageType, string>;
};

const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim().toLowerCase();
const needsAppointmentImages = (value: string) => {
    const normalized = normalizeName(value);
    return normalized.includes('tich hen') && normalized.includes('ok');
};

let cachedIndex: IndexRow[] | null = null;
let cacheLoadedAt = 0;

function getAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_PRIVATE_KEY;
    if (!email || !key) throw new Error('Thiếu cấu hình Google Service Account.');
    key = key.replace(/^"|"$/g, '').replace(/\\n/g, '\n').trim();
    return new JWT({
        email,
        key,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
        ],
    });
}

function getSheetsApi() {
    return google.sheets({ version: 'v4', auth: getAuth() });
}

const valueAt = (row: string[], index: number) => String(row[index] || '');
const toIndexRow = (values: string[], rowNumber: number): IndexRow => ({
    rowNumber,
    key: valueAt(values, 0), requestType: valueAt(values, 1), service: valueAt(values, 2),
    customer: valueAt(values, 3), account: valueAt(values, 4), address: valueAt(values, 5),
    completedAt: valueAt(values, 6), installer: valueAt(values, 7), appointmentTick: valueAt(values, 8),
    images: { before: valueAt(values, 9), after: valueAt(values, 10), appointment: valueAt(values, 11) },
    check: valueAt(values, 12),
    links: { before: valueAt(values, 21), after: valueAt(values, 22), appointment: valueAt(values, 23) },
});

async function loadIndex(force = false) {
    if (!force && cachedIndex && Date.now() - cacheLoadedAt < CACHE_MS) return cachedIndex;
    // Đọc theo tọa độ cột để không bị lỗi khi Sheet có tiêu đề #REF! trùng nhau.
    const response = await getSheetsApi().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${SHEET_NAME}'!A2:X` });
    cachedIndex = (response.data.values || []).map((row, index) => toIndexRow(row.map(String), index + 2)).filter((row) => row.key || row.account);
    cacheLoadedAt = Date.now();
    return cachedIndex;
}

const typeConfig: Record<ImageType, { label: string; fileLabel: string; valueColumn: string; linkColumn: string }> = {
    before: { label: 'Ảnh trước', fileLabel: 'Image trước', valueColumn: 'J', linkColumn: 'V' },
    after: { label: 'Ảnh sau', fileLabel: 'Image Sau', valueColumn: 'K', linkColumn: 'W' },
    appointment: { label: 'Biên bản hẹn', fileLabel: 'BB HẸN', valueColumn: 'L', linkColumn: 'X' },
};

function safeFilePart(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 160) || 'PT_MOI';
}

function formatVietnamDateTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function parseVietnamDateTime(value: string) {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const [, day, month, year, hour, minute, second = '0'] = match;
    // Giờ Việt Nam (UTC+7) để phép so sánh 48 giờ không phụ thuộc múi giờ máy chủ.
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute), Number(second)));
}

async function validateDocumentImage(fileData: string, mimeType: string) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY để kiểm tra biên bản.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [
                    { text: `Phân loại ảnh tải lên cho hệ thống lưu biên bản. Chỉ chấp nhận ảnh là văn bản/biên bản/phiếu có nội dung chữ đọc được, có thể gồm con dấu, chữ ký, bảng biểu hoặc chữ viết tay. Từ chối ảnh chủ yếu là người, đồ vật, phương tiện, hiện trường, phong cảnh, ảnh selfie hoặc ảnh không phải tài liệu. Trả về JSON duy nhất: {"isValidDocument": boolean, "reason": "lý do ngắn gọn tiếng Việt"}.` },
                    { inlineData: { mimeType, data: fileData } },
                ] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 120 },
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            // Hết quota/token Gemini: không chặn nghiệp vụ upload ảnh.
            if (response.status === 429 || /resource_exhausted|quota|rate limit/i.test(errorBody)) {
                console.warn('[image-control] Gemini quota exhausted; skipping document validation.');
                return;
            }
            throw new Error(`Không thể kiểm tra ảnh biên bản (HTTP ${response.status}).`);
        }
        const payload: any = await response.json();
        const raw = String(payload.candidates?.[0]?.content?.parts?.[0]?.text || '');
        // Gemini đôi khi thêm câu dẫn như "Here is the JSON" dù đã yêu cầu JSON mode.
        const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonText) {
            const normalized = normalizeName(raw);
            if (/nguoi|do vat|phuong tien|phong canh|hien truong|selfie|khong phai.*tai lieu/.test(normalized)) {
                const error: any = new Error('Biên bản không hợp lệ: Ảnh không phải văn bản/biên bản.');
                error.statusCode = 422;
                throw error;
            }
            console.warn('[image-control] Gemini returned no JSON; allowing upload without AI validation.');
            return;
        }
        let result: any;
        try {
            result = JSON.parse(jsonText);
        } catch {
            console.warn('[image-control] Gemini returned malformed JSON; allowing upload without AI validation.');
            return;
        }
        if (result.isValidDocument !== true) {
            const reason = typeof result.reason === 'string' ? result.reason : 'Ảnh không phải văn bản/biên bản hợp lệ.';
            const error: any = new Error(`Biên bản không hợp lệ: ${reason}`);
            error.statusCode = 422;
            throw error;
        }
    } catch (error: any) {
        if (error?.name === 'AbortError') throw new Error('Kiểm tra ảnh biên bản quá thời gian chờ. Vui lòng thử lại.');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export default async function imageControlHandler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method === 'GET') {
            const query = String(req.query.q || '').trim().toLocaleLowerCase('vi');
            const installerName = String(req.query.installerName || '').trim();
            const installerFilter = String(req.query.installerFilter || '').trim();
            const uploadStatus = String(req.query.uploadStatus || 'all');
            const isAdminView = String(req.query.admin || '') === 'true';
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 30));
            if (!installerName) return res.status(400).json({ error: 'Không xác định được nhân viên đăng nhập.' });
            const index = await loadIndex();
            const expectedInstaller = normalizeName(installerName);
            const expectedFilter = normalizeName(installerFilter);
            const visibleRows = index.filter((row) => {
                const belongsToEmployee = isAdminView || normalizeName(row.installer) === expectedInstaller;
                const matchesInstaller = !isAdminView || !expectedFilter || normalizeName(row.installer) === expectedFilter;
                const requiresAppointmentRecord = needsAppointmentImages(row.appointmentTick);
                // Ảnh trước và Ảnh sau luôn bắt buộc. BB HẸN chỉ bắt buộc khi TICK HẸN là OK.
                const isPending = !row.images.before.trim()
                    || !row.images.after.trim()
                    || (requiresAppointmentRecord && !row.images.appointment.trim());
                const matchesSearch = !query || [row.key, row.account, row.customer].some((value) => value.toLocaleLowerCase('vi').includes(query));
                return belongsToEmployee && matchesInstaller && matchesSearch;
            });
            const isUploaded = (row: IndexRow) => Boolean(row.images.before.trim()
                && row.images.after.trim()
                && (!needsAppointmentImages(row.appointmentTick) || row.images.appointment.trim()));
            const summary = isAdminView ? visibleRows.reduce((result, row) => {
                if (isUploaded(row)) result.uploaded += 1;
                else result.pending += 1;
                result.total += 1;
                return result;
            }, { total: 0, uploaded: 0, pending: 0 }) : undefined;
            const matches = visibleRows.filter((row) => {
                const uploaded = isUploaded(row);
                if (!isAdminView) return !uploaded;
                if (uploadStatus === 'uploaded') return uploaded;
                if (uploadStatus === 'pending') return !uploaded;
                return true;
            });
            const start = (page - 1) * pageSize;
            const installers = isAdminView
                ? [...new Map(index.map((row) => [normalizeName(row.installer), row.installer.trim()] as const).filter(([name]) => Boolean(name))).values()]
                    .sort((a, b) => a.localeCompare(b, 'vi'))
                : undefined;
            return res.json({ rows: matches.slice(start, start + pageSize), total: matches.length, page, pageSize, installers, summary });
        }

        if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
        const { rowNumber, imageType, fileName, mimeType, fileData, installerName, files } = req.body || {};
        if (!Number.isInteger(Number(rowNumber)) || Number(rowNumber) < 2) return res.status(400).json({ error: 'Dòng dữ liệu không hợp lệ.' });
        const requestedFiles = Array.isArray(files)
            ? files
            : [{ imageType, fileName, mimeType, fileData }];
        if (!requestedFiles.length || requestedFiles.length > 3) return res.status(400).json({ error: 'Cần chọn từ 1 đến 3 ảnh để lưu.' });
        const uniqueTypes = new Set<string>();
        for (const item of requestedFiles) {
            if (!Object.hasOwn(typeConfig, item?.imageType) || uniqueTypes.has(item.imageType)) return res.status(400).json({ error: 'Loại ảnh không hợp lệ.' });
            uniqueTypes.add(item.imageType);
            if (typeof item.fileData !== 'string' || !item.fileData || typeof item.mimeType !== 'string' || !item.mimeType.startsWith('image/')) return res.status(400).json({ error: 'Chỉ chấp nhận tệp hình ảnh hợp lệ.' });
            const itemBuffer = Buffer.from(item.fileData, 'base64');
            if (!itemBuffer.length || itemBuffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Mỗi ảnh phải có kích thước từ 1 byte đến 10 MB.' });
        }

        const targetRow = Number(rowNumber);
        const sheets = getSheetsApi();
        const lookup = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${SHEET_NAME}'!A${targetRow}:X${targetRow}` });
        const values = (lookup.data.values?.[0] || []).map(String);
        if (!values.length) return res.status(404).json({ error: 'Không tìm thấy dòng dữ liệu cần cập nhật.' });
        const row = toIndexRow(values, targetRow);
        if (!installerName || normalizeName(row.installer) !== normalizeName(String(installerName))) {
            return res.status(403).json({ error: 'Bạn chỉ có thể tải ảnh cho công việc của chính mình.' });
        }
        if (uniqueTypes.has('appointment') && !needsAppointmentImages(row.appointmentTick)) {
            return res.status(403).json({ error: 'Chỉ các công việc có TICK HẸN là “Tích hẹnn: OK” mới cần tải ảnh.' });
        }
        const isBatchSave = Array.isArray(files);
        if (isBatchSave) {
            const required: ImageType[] = ['before', 'after', ...(needsAppointmentImages(row.appointmentTick) ? ['appointment' as ImageType] : [])];
            if (required.some((type) => !row.images[type].trim() && !uniqueTypes.has(type))) {
                return res.status(400).json({ error: 'Vui lòng chọn đủ các ảnh bắt buộc trước khi lưu.' });
            }
        }
        const key = row.key || 'PT_MOI';
        const uploadTime = new Date();
        const completionTime = parseVietnamDateTime(row.completedAt);
        if (!completionTime) return res.status(422).json({ error: 'Ngày kết thúc thực tế không đúng định dạng dd/MM/yyyy HH:mm:ss.' });
        const note = uploadTime.getTime() - completionTime.getTime() > 48 * 60 * 60 * 1000 ? 'Quá hạn' : 'Trong hạn';
        // Kiểm tra trước toàn bộ ảnh, sau đó mới bắt đầu ghi Drive. Khi AI hết quota,
        // validateDocumentImage tự bỏ qua để không chặn nghiệp vụ.
        await Promise.all(requestedFiles.map((item) => validateDocumentImage(item.fileData, item.mimeType)));
        const uploadedFiles = await Promise.all(requestedFiles.map(async (item) => {
            const config = typeConfig[item.imageType as ImageType];
            const extension = (String(item.fileName || '').split('.').pop() || item.mimeType.split('/').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const storageName = `${safeFilePart(key)}.${config.fileLabel}.${extension}`;
            // Apps Script chạy bằng tài khoản Google có quota Drive; truyền tường minh folderId
            // để script lưu vào đúng thư mục phân hệ, thay vì quota-less Service Account.
            const uploaded: any = await uploadToGoogleDrive(Buffer.from(item.fileData, 'base64'), storageName, item.mimeType, DRIVE_FOLDER_ID);
            return { imageType: item.imageType as ImageType, storageName, link: uploaded?.webViewLink || uploaded?.url || uploaded?.fileUrl || '' };
        }));
        const changes = uploadedFiles.flatMap((item) => {
            const config = typeConfig[item.imageType];
            return [
                { range: `'${SHEET_NAME}'!${config.valueColumn}${targetRow}`, values: [[item.storageName]] },
                { range: `'${SHEET_NAME}'!${config.linkColumn}${targetRow}`, values: [[item.link]] },
            ];
        });
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: [
                    ...changes,
                    { range: `'${SHEET_NAME}'!N${targetRow}`, values: [[formatVietnamDateTime(uploadTime)]] },
                    { range: `'${SHEET_NAME}'!U${targetRow}`, values: [[note]] },
                ],
            },
        });
        cachedIndex = null;
        cacheLoadedAt = 0;
        return res.status(201).json({ success: true, files: uploadedFiles, rowNumber });
    } catch (error: any) {
        console.error('[image-control] error:', error);
        return res.status(error?.statusCode || 500).json({ error: error?.message || 'Không thể xử lý yêu cầu kiểm soát hình ảnh.' });
    }
}
