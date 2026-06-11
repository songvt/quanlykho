import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_utils/supabase.js';
import { jsPDF } from 'jspdf';
import { JWT } from 'google-auth-library';

// Helper to get Google Cloud Vision OAuth2 Access Token using Service Account from .env
const getVisionOauthToken = async () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!email || !privateKey) {
        throw new Error('Thiếu cấu hình GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_PRIVATE_KEY trong .env');
    }

    const client = new JWT({
        email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const credentials = await client.getAccessToken();
    return credentials.token;
};

// Helper to check if Supabase storage bucket exists, and create it if not
const ensureOcrBucketExists = async () => {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error('[Supabase Storage] List buckets error:', error);
            return;
        }
        
        const exists = buckets?.some(b => b.name === 'ocr-documents');
        if (!exists) {
            const { error: createError } = await supabase.storage.createBucket('ocr-documents', {
                public: true,
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
                fileSizeLimit: 15728640 // 15MB
            });
            if (createError) {
                console.error('[Supabase Storage] Create bucket error:', createError);
            } else {
                console.log('[Supabase Storage] Created bucket "ocr-documents" successfully.');
            }
        }
    } catch (err) {
        console.error('[Supabase Storage] Exception ensuring bucket exists:', err);
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type } = req.query;

    try {
        // 1. UPLOAD IMAGE API
        if (type === 'upload') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
            
            const { fileName, mimeType, fileData, userId } = req.body;
            if (!fileData) {
                return res.status(400).json({ error: 'Dữ liệu file (base64) không được để trống' });
            }

            const buffer = Buffer.from(fileData, 'base64');
            const fileExt = fileName.split('.').pop() || 'png';
            const storagePath = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Tải lên Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('ocr-documents')
                .upload(storagePath, buffer, {
                    contentType: mimeType || 'image/png',
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                throw new Error(`Lỗi tải lên Storage: ${uploadError.message}`);
            }

            const publicUrl = supabase.storage.from('ocr-documents').getPublicUrl(storagePath).data.publicUrl;

            // Lưu thông tin vào database
            const { data: dbData, error: dbError } = await supabase
                .from('upload_files')
                .insert({
                    user_id: userId || null,
                    file_name: fileName || 'unnamed_image.png',
                    file_path: storagePath,
                    file_size: buffer.length,
                    mime_type: mimeType || 'image/png',
                    status: 'uploaded'
                })
                .select()
                .single();

            if (dbError) {
                throw new Error(`Lỗi lưu DB: ${dbError.message}`);
            }

            // Ghi log bảo mật/thao tác
            await supabase.from('processing_logs').insert({
                user_id: userId || null,
                action: 'upload',
                status: 'success',
                details: `Đã tải lên tệp: ${fileName} (${buffer.length} bytes)`
            });

            return res.status(200).json({
                success: true,
                file: {
                    ...dbData,
                    public_url: publicUrl
                }
            });
        }

        // 2. ENHANCE IMAGE API (Lưu ảnh đã xử lý từ client)
        if (type === 'enhance') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

            const { fileId, fileData, userId } = req.body;
            if (!fileId || !fileData) {
                return res.status(400).json({ error: 'Thiếu fileId hoặc dữ liệu ảnh đã cải thiện' });
            }

            // Lấy thông tin tệp cũ
            const { data: originalFile, error: fetchErr } = await supabase
                .from('upload_files')
                .select('*')
                .eq('id', fileId)
                .single();

            if (fetchErr || !originalFile) {
                return res.status(404).json({ error: 'Không tìm thấy tệp gốc' });
            }

            const buffer = Buffer.from(fileData, 'base64');
            const fileExt = originalFile.file_name.split('.').pop() || 'png';
            const enhancedPath = `enhanced/${fileId}_enhanced.${fileExt}`;

            // Tải tệp đã xử lý lên storage
            const { error: uploadError } = await supabase.storage
                .from('ocr-documents')
                .upload(enhancedPath, buffer, {
                    contentType: originalFile.mime_type,
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                throw new Error(`Lỗi lưu trữ ảnh cải thiện: ${uploadError.message}`);
            }

            // Cập nhật đường dẫn enhanced_path và trạng thái
            const { data: updatedFile, error: dbError } = await supabase
                .from('upload_files')
                .update({
                    enhanced_path: enhancedPath,
                    status: 'enhanced'
                })
                .eq('id', fileId)
                .select()
                .single();

            if (dbError) {
                throw new Error(`Lỗi cập nhật DB: ${dbError.message}`);
            }

            const enhancedUrl = supabase.storage.from('ocr-documents').getPublicUrl(enhancedPath).data.publicUrl;

            // Ghi log
            await supabase.from('processing_logs').insert({
                user_id: userId || null,
                action: 'enhance',
                status: 'success',
                details: `Đã tối ưu hóa tệp: ${originalFile.file_name}`
            });

            return res.status(200).json({
                success: true,
                file: {
                    ...updatedFile,
                    enhanced_url: enhancedUrl
                }
            });
        }

        // 3. OCR PROCESSING API (Sử dụng Gemini AI hoặc Google Cloud Vision để nhận diện)
        if (type === 'process') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

            const { fileIds, userId, engine } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
                return res.status(400).json({ error: 'Danh sách fileIds là bắt buộc' });
            }

            const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
            
            const ocrResults = [];

            for (const fileId of fileIds) {
                // Lấy ảnh gốc hoặc ảnh đã nâng cao
                const { data: fileItem, error: fetchErr } = await supabase
                    .from('upload_files')
                    .select('*')
                    .eq('id', fileId)
                    .single();

                if (fetchErr || !fileItem) {
                    continue; // Bỏ qua nếu không thấy file
                }

                // Cập nhật trạng thái sang processing
                await supabase.from('upload_files').update({ status: 'processing' }).eq('id', fileId);

                // Lấy dữ liệu file từ Storage để gửi cho Gemini/Vision
                const activePath = fileItem.enhanced_path || fileItem.file_path;
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('ocr-documents')
                    .download(activePath);

                if (downloadError || !fileData) {
                    await supabase.from('upload_files').update({ status: 'failed' }).eq('id', fileId);
                    continue;
                }

                // Chuyển sang base64
                const arrayBuffer = await fileData.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');

                let parsedOcrResult: any;

                if (engine === 'google-vision') {
                    try {
                        const token = await getVisionOauthToken();
                        const visionUrl = 'https://vision.googleapis.com/v1/images:annotate';
                        
                        const response = await fetch(visionUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                requests: [
                                    {
                                        image: {
                                            content: base64Data
                                        },
                                        features: [
                                            {
                                                type: 'DOCUMENT_TEXT_DETECTION'
                                            }
                                        ]
                                    }
                                ]
                            })
                        });

                        if (!response.ok) {
                            const errBody = await response.text();
                            throw new Error(`Google Vision API returned status ${response.status}: ${errBody}`);
                        }

                        const resData = await response.json();
                        const annotation = resData.responses?.[0]?.fullTextAnnotation;
                        const rawText = annotation?.text || 'Không nhận diện được chữ.';

                        // Gọi thêm Gemini để phân tích cấu trúc text (không bắt buộc)
                        let structuredData = { document_type: 'Tài liệu số hóa (Google Vision)' };
                        
                        if (apiKey) {
                            try {
                                const structPrompt = `Bạn là trợ lý phân tích dữ liệu. Hãy phân tích đoạn văn bản OCR sau và trích xuất thông tin cấu trúc JSON gồm:
1. "document_type" (Hóa đơn/Biên bản/Khác...)
2. "metadata" (các cặp key-value quan trọng như số chứng từ, ngày tháng, tên các bên, địa chỉ,...)
3. "items" (danh sách sản phẩm/tài sản nếu có gồm tên/description, số lượng, đơn giá, thành tiền/serial/note...)

Trả về đúng định dạng JSON:
{
  "document_type": "...",
  "metadata": { ... },
  "items": [ ... ]
}

Văn bản OCR:
${rawText}`;

                                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                                const structResponse = await fetch(geminiUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        contents: [{ parts: [{ text: structPrompt }] }],
                                        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                                    })
                                });
                                
                                if (structResponse.ok) {
                                    const structData = await structResponse.json();
                                    structuredData = JSON.parse(structData.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
                                }
                            } catch (e) {
                                console.warn('Không thể cấu trúc hóa dữ liệu bằng Gemini, sử dụng cấu trúc mặc định.', e);
                            }
                        }

                        parsedOcrResult = {
                            text: rawText,
                            language: 'vi',
                            confidence: 99,
                            data: structuredData
                        };

                    } catch (visionErr: any) {
                        console.error('Google Vision OCR Error:', visionErr);
                        await supabase.from('upload_files').update({ status: 'failed' }).eq('id', fileId);
                        
                        await supabase.from('processing_logs').insert({
                            user_id: userId || null,
                            action: 'ocr_process',
                            status: 'failed',
                            details: `Lỗi gọi Google Vision API cho file ${fileItem.file_name}: ${visionErr.message}`
                        });

                        return res.status(500).json({
                            error: `Lỗi nhận diện Google Vision API: ${visionErr.message}`
                        });
                    }
                } else {
                    // Sử dụng Gemini AI
                    if (!apiKey) {
                        return res.status(500).json({ error: 'Cấu hình thiếu GEMINI_API_KEY trong biến môi trường.' });
                    }

                    // Gọi Gemini 2.5 Flash API để phân tích hình ảnh (Multimodal OCR)
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                    
                    const prompt = `Bạn là hệ thống OCR tài liệu thông minh. Nhiệm vụ của bạn là:
1. Nhận diện chính xác toàn bộ văn bản trong ảnh (bao gồm cả chữ viết tay và chữ in tiếng Việt).
2. Trích xuất toàn bộ văn bản thô này thành trường "text" dạng string sạch sẽ, giữ nguyên ngắt dòng hợp lý.
3. Nhận diện loại văn bản (Hóa đơn, Phiếu xuất kho, Phiếu nhập kho, Biên bản bàn giao, Thẻ căn cước, khác...).
4. Trích xuất các trường thông tin quan trọng cấu trúc thành một đối tượng JSON trong trường "data" (ví dụ: Số hóa đơn, ngày tháng, tên khách hàng/đơn vị, danh sách mặt hàng gồm tên, số lượng, đơn giá, tổng tiền, người ký...). Nếu là văn bản thường, chỉ cần trích xuất các tiêu đề chính hoặc metadata.
5. Xác định mã ngôn ngữ chính ("vi" hoặc "en") trong trường "language" và độ tin cậy ước tính (từ 0 đến 100) trong trường "confidence".

Hãy trả về kết quả ĐÚNG ĐỊNH DẠNG JSON với cấu trúc sau:
{
  "text": "văn bản thô...",
  "language": "vi",
  "confidence": 95,
  "data": {
     "document_type": "Hóa đơn/Biên bản/...",
     "metadata": { ... },
     "items": [ ... ]
  }
}`;

                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: prompt },
                                    {
                                        inlineData: {
                                            mimeType: fileItem.mime_type,
                                            data: base64Data
                                        }
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.1
                        }
                    })
                });

                if (!response.ok) {
                    const errorJson = await response.json().catch(() => ({}));
                    const msg = errorJson.error?.message || `Lỗi gọi Gemini AI: ${response.statusText}`;
                    
                    await supabase.from('upload_files').update({ status: 'failed' }).eq('id', fileId);
                    
                    await supabase.from('processing_logs').insert({
                        user_id: userId || null,
                        action: 'ocr_process',
                        status: 'failed',
                        details: `Lỗi gọi Gemini AI cho file ${fileItem.file_name}: ${msg}`
                    });

                    return res.status(response.status).json({
                        error: `Lỗi nhận diện OCR AI: ${msg}`
                    });
                }

                const resData = await response.json();
                const rawJsonString = resData.candidates?.[0]?.content?.parts?.[0]?.text;
                
                try {
                    parsedOcrResult = JSON.parse(rawJsonString);
                } catch (jsonErr) {
                    parsedOcrResult = {
                        text: rawJsonString || 'Không thể giải mã dữ liệu text từ AI.',
                        language: 'vi',
                        confidence: 70,
                        data: {}
                    };
                }
            }

            // Lưu kết quả OCR vào Database
            const { data: dbOcr, error: dbOcrErr } = await supabase
                .from('ocr_results')
                .insert({
                    file_id: fileId,
                    raw_text: parsedOcrResult.text,
                    structured_data: parsedOcrResult.data || {},
                    language: parsedOcrResult.language || 'vi',
                    confidence: parsedOcrResult.confidence || 90,
                    engine: engine === 'google-vision' ? 'google-vision' : 'gemini-2.5-flash'
                })
                .select()
                .single();

            if (dbOcrErr) {
                console.error('Save OCR Result error:', dbOcrErr);
            }

            // Cập nhật trạng thái file thành completed
            await supabase.from('upload_files').update({ status: 'completed' }).eq('id', fileId);

            ocrResults.push({
                file_id: fileId,
                fileName: fileItem.file_name,
                ocr: dbOcr || parsedOcrResult
            });

            // Ghi log thành công
            await supabase.from('processing_logs').insert({
                user_id: userId || null,
                action: 'ocr_process',
                status: 'success',
                details: `Đã OCR thành công file: ${fileItem.file_name} (Độ tin cậy: ${parsedOcrResult.confidence}%)`
            });
        }

            return res.status(200).json({
                success: true,
                results: ocrResults
            });
        }

        // 4. EXPORT PDF API (Tạo PDF hoặc Searchable PDF từ danh sách ảnh đã xử lý)
        if (type === 'export') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

            const { fileIds, title, isSearchable, userId } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
                return res.status(400).json({ error: 'fileIds là bắt buộc và phải là một mảng' });
            }

            // Lấy thông tin chi tiết của các tệp ảnh
            const { data: files, error: filesErr } = await supabase
                .from('upload_files')
                .select('*')
                .in('id', fileIds);

            if (filesErr || !files || files.length === 0) {
                return res.status(404).json({ error: 'Không tìm thấy các tệp ảnh tương ứng' });
            }

            // Sắp xếp các tệp ảnh theo đúng thứ tự mảng fileIds truyền lên
            const sortedFiles = fileIds.map(id => files.find(f => f.id === id)).filter(Boolean) as any[];

            // Khởi tạo tài liệu PDF (jsPDF)
            // Khởi tạo tài liệu dạng đứng (portrait), đơn vị pt, khổ a4 [595.28, 841.89]
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4'
            });

            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();

            for (let i = 0; i < sortedFiles.length; i++) {
                const fileItem = sortedFiles[i];
                if (i > 0) doc.addPage();

                // Lấy ảnh từ storage
                const activePath = fileItem.enhanced_path || fileItem.file_path;
                const { data: imgData } = await supabase.storage
                    .from('ocr-documents')
                    .download(activePath);

                if (imgData) {
                    const arrayBuffer = await imgData.arrayBuffer();
                    const base64Img = Buffer.from(arrayBuffer).toString('base64');
                    const mimeType = fileItem.mime_type;

                    // Vẽ ảnh phủ toàn bộ trang PDF
                    const imgFormat = mimeType.split('/').pop()?.toUpperCase() === 'PNG' ? 'PNG' : 'JPEG';
                    doc.addImage(base64Img, imgFormat, 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

                    // Nếu yêu cầu Searchable PDF, chèn thêm lớp văn bản ẩn (font màu trong suốt hoặc tàng hình)
                    if (isSearchable) {
                        // Lấy kết quả OCR tương ứng của file này
                        const { data: ocrRes } = await supabase
                            .from('ocr_results')
                            .select('raw_text')
                            .eq('file_id', fileItem.id)
                            .maybeSingle();

                        if (ocrRes?.raw_text) {
                            // Cấu hình chữ tàng hình bằng cách thiết đặt màu văn bản giống nền hoặc dùng API ẩn
                            // Cách thực tế nhất trên jspdf là vẽ text với chế độ hiển thị renderingMode = 3 (Invisible)
                            // Hoặc set màu chữ cực kỳ mờ, hoặc đặt màu trong suốt.
                            // jspdf hỗ trợ set màu fill bằng hex hoặc rgb.
                            // Ta sử dụng chế độ ẩn (invisible text) bằng cách đặt text rendering mode = 3
                            doc.setTextColor(0, 0, 0); // Reset màu
                            // @ts-ignore
                            doc.textWithLink('', 0, 0, {}); // Kích hoạt render
                            // Sử dụng lệnh PDF gốc để bật text ẩn: 3 Tr
                            // @ts-ignore
                            doc.internal.write('3 Tr\n'); // Thiết lập Text Rendering Mode thành 3 (Neither fill nor stroke text - Invisible)

                            // Tách dòng văn bản và vẽ dọc theo trang để người dùng có thể bôi đen tìm kiếm được
                            const lines = ocrRes.raw_text.split('\n');
                            doc.setFontSize(10);
                            let yPos = 40;
                            lines.forEach((line: string) => {
                                if (line.trim().length > 0 && yPos < pdfHeight - 20) {
                                    doc.text(line.substring(0, 80), 30, yPos);
                                    yPos += 18;
                                }
                            });
                            
                            // Trả text rendering mode về bình thường (0 Tr - Fill text)
                            // @ts-ignore
                            doc.internal.write('0 Tr\n');
                        }
                    }
                }
            }

            // Chuyển PDF thành Buffer
            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
            const pdfFileName = `${title ? title.replace(/\s+/g, '_') : 'document'}_${Date.now()}.pdf`;
            const pdfStoragePath = `pdfs/${pdfFileName}`;

            // Tải lên Supabase Storage
            const { error: uploadErr } = await supabase.storage
                .from('ocr-documents')
                .upload(pdfStoragePath, pdfBuffer, {
                    contentType: 'application/pdf',
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadErr) {
                throw new Error(`Lỗi tải lên tệp PDF: ${uploadErr.message}`);
            }

            // Lưu thông tin PDF vào DB
            const { data: pdfDoc, error: dbErr } = await supabase
                .from('pdf_documents')
                .insert({
                    user_id: userId || null,
                    title: title || 'Tài liệu OCR xuất bản',
                    pdf_path: pdfStoragePath,
                    is_searchable: !!isSearchable,
                    page_count: sortedFiles.length
                })
                .select()
                .single();

            if (dbErr) {
                throw new Error(`Lỗi lưu PDF vào DB: ${dbErr.message}`);
            }

            const publicUrl = supabase.storage.from('ocr-documents').getPublicUrl(pdfStoragePath).data.publicUrl;

            // Ghi log
            await supabase.from('processing_logs').insert({
                user_id: userId || null,
                action: 'export_pdf',
                status: 'success',
                details: `Đã xuất bản tệp PDF Searchable: ${pdfFileName} (${sortedFiles.length} trang)`
            });

            return res.status(200).json({
                success: true,
                pdf: {
                    ...pdfDoc,
                    pdf_url: publicUrl
                }
            });
        }

        // 5. DOWNLOAD DOCX / JSON / TXT API
        if (type === 'download') {
            const { id, format } = req.query; // id của ocr_result hoặc pdf_document
            if (!id) {
                return res.status(400).json({ error: 'Thiếu id để tải xuống' });
            }

            // Lấy kết quả OCR
            const { data: ocrRes, error: fetchErr } = await supabase
                .from('ocr_results')
                .select(`
                    id,
                    raw_text,
                    structured_data,
                    upload_files (
                        file_name
                    )
                `)
                .eq('id', id)
                .single() as any;

            if (fetchErr || !ocrRes) {
                return res.status(404).json({ error: 'Không tìm thấy kết quả OCR tương ứng' });
            }

            const baseName = ocrRes.upload_files?.file_name ? ocrRes.upload_files.file_name.replace(/\.[^/.]+$/, "") : 'document';

            // Xuất dạng TEXT
            if (format === 'txt') {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseName)}.txt"`);
                return res.status(200).send(ocrRes.raw_text);
            }

            // Xuất dạng JSON
            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseName)}.json"`);
                return res.status(200).json(ocrRes.structured_data);
            }

            // Xuất dạng Word (doc/docx kiểu HTML mờ)
            if (format === 'docx' || format === 'doc') {
                const data = ocrRes.structured_data || {};
                const docType = data.document_type || 'Tài liệu số hóa';
                let docBody = '';

                // If we have structured invoice/billing data
                if (docType.toLowerCase().includes('hóa đơn') || docType.toLowerCase().includes('invoice') || docType.toLowerCase().includes('phiếu xuất') || docType.toLowerCase().includes('phiếu nhập')) {
                    const title = docType.toUpperCase();
                    const metadata = data.metadata || {};
                    const items = data.items || [];
                    
                    docBody = `
                        <div style="text-align: center; margin-bottom: 24pt;">
                            <span style="font-size: 16pt; font-weight: bold; display: block;">${title}</span>
                            ${metadata.invoice_number ? `<span style="font-size: 11pt; color: #475569;">Số: ${metadata.invoice_number}</span>` : ''}
                        </div>
                        
                        <table style="width: 100%; border: none; margin-bottom: 18pt;">
                            <tr>
                                <td style="border: none; width: 50%; padding: 4pt 0; vertical-align: top;">
                                    <strong>Đơn vị cung cấp / Bán:</strong><br/>
                                    ${metadata.seller_name || 'N/A'}<br/>
                                    ${metadata.seller_address ? `Địa chỉ: ${metadata.seller_address}<br/>` : ''}
                                    ${metadata.seller_tax_id ? `MST: ${metadata.seller_tax_id}` : ''}
                                </td>
                                <td style="border: none; width: 50%; padding: 4pt 0; vertical-align: top;">
                                    <strong>Đơn vị nhận / Mua:</strong><br/>
                                    ${metadata.buyer_name || 'N/A'}<br/>
                                    ${metadata.buyer_address ? `Địa chỉ: ${metadata.buyer_address}<br/>` : ''}
                                    ${metadata.buyer_tax_id ? `MST: ${metadata.buyer_tax_id}` : ''}
                                </td>
                            </tr>
                            <tr>
                                <td style="border: none; padding: 4pt 0;">
                                    <strong>Ngày lập:</strong> ${metadata.date || new Date().toLocaleDateString('vi-VN')}
                                </td>
                                <td style="border: none; padding: 4pt 0;">
                                    <strong>Hình thức thanh toán:</strong> ${metadata.payment_method || 'N/A'}
                                </td>
                            </tr>
                        </table>

                        <h3>DANH SÁCH CHI TIẾT HÀNG HÓA / DỊCH VỤ</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 18pt;">
                            <thead>
                                <tr style="background-color: #f2f2f2;">
                                    <th style="border: 1px solid black; padding: 6pt; text-align: center; width: 5%;">STT</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: left; width: 45%;">Tên hàng hóa, dịch vụ</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: center; width: 10%;">ĐVT</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: right; width: 10%;">SL</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: right; width: 15%;">Đơn giá</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: right; width: 15%;">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items && items.length > 0 ? items.map((item: any, idx: number) => `
                                    <tr>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: center;">${idx + 1}</td>
                                        <td style="border: 1px solid black; padding: 6pt;">${item.name || item.description || 'N/A'}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: center;">${item.unit || '-'}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: right;">${item.quantity || 1}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: right;">${item.unit_price ? Number(item.unit_price).toLocaleString('vi-VN') : '-'}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: right;">${item.amount ? Number(item.amount).toLocaleString('vi-VN') : (item.quantity && item.unit_price ? Number(item.quantity * item.unit_price).toLocaleString('vi-VN') : '-')}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="border: 1px solid black; padding: 12pt; text-align: center; color: #64748b;">Không có chi tiết mặt hàng</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>

                        <table style="width: 40%; margin-left: auto; border: none; margin-bottom: 24pt;">
                            ${metadata.subtotal ? `<tr><td style="border: none; text-align: right; padding: 4pt 0;">Cộng tiền hàng:</td><td style="border: none; text-align: right; font-weight: bold;">${Number(metadata.subtotal).toLocaleString('vi-VN')} đ</td></tr>` : ''}
                            ${metadata.tax_rate ? `<tr><td style="border: none; text-align: right; padding: 4pt 0;">Thuế suất GTGT:</td><td style="border: none; text-align: right;">${metadata.tax_rate}%</td></tr>` : ''}
                            ${metadata.tax_amount ? `<tr><td style="border: none; text-align: right; padding: 4pt 0;">Tiền thuế GTGT:</td><td style="border: none; text-align: right;">${Number(metadata.tax_amount).toLocaleString('vi-VN')} đ</td></tr>` : ''}
                            ${metadata.total_amount ? `<tr><td style="border: none; text-align: right; padding: 4pt 0; font-size: 11pt; font-weight: bold;">Tổng cộng thanh toán:</td><td style="border: none; text-align: right; font-size: 11pt; font-weight: bold; color: #b91c1c;">${Number(metadata.total_amount).toLocaleString('vi-VN')} đ</td></tr>` : ''}
                        </table>
                    `;
                } else if (docType.toLowerCase().includes('biên bản') || docType.toLowerCase().includes('handover') || docType.toLowerCase().includes('nghiệm thu')) {
                    const metadata = data.metadata || {};
                    const items = data.items || [];
                    
                    docBody = `
                        <div style="text-align: center; margin-bottom: 6pt;">
                            <span style="font-size: 12pt; font-weight: bold; letter-spacing: 0.5px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span><br/>
                            <span style="font-size: 11pt; font-weight: bold; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</span>
                        </div>
                        
                        <div style="text-align: center; margin-top: 18pt; margin-bottom: 18pt;">
                            <span style="font-size: 14pt; font-weight: bold; display: block;">${docType.toUpperCase()}</span>
                            ${metadata.date ? `<span style="font-size: 10pt; font-style: italic;">Ngày ${metadata.date}</span>` : ''}
                        </div>

                        <p>Hôm nay, ngày ${metadata.date || '...'}, tại ${metadata.location || '...'}, chúng tôi gồm:</p>
                        
                        <table style="width: 100%; border: none; margin-bottom: 12pt;">
                            <tr>
                                <td style="border: none; width: 50%; padding: 4pt 0; vertical-align: top;">
                                    <strong>ĐẠI DIỆN BÊN GIAO (Bên A):</strong><br/>
                                    Họ và tên: ${metadata.giver_name || '...'}<br/>
                                    Chức vụ: ${metadata.giver_title || '...'}<br/>
                                    Đơn vị: ${metadata.giver_unit || '...'}
                                </td>
                                <td style="border: none; width: 50%; padding: 4pt 0; vertical-align: top;">
                                    <strong>ĐẠI DIỆN BÊN NHẬN (Bên B):</strong><br/>
                                    Họ và tên: ${metadata.receiver_name || '...'}<br/>
                                    Chức vụ: ${metadata.receiver_title || '...'}<br/>
                                    Đơn vị: ${metadata.receiver_unit || '...'}
                                </td>
                            </tr>
                        </table>

                        <p>Hai bên thống nhất thực hiện bàn giao các trang thiết bị/tài sản với danh mục cụ thể dưới đây:</p>

                        <table style="width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 18pt;">
                            <thead>
                                <tr style="background-color: #f2f2f2;">
                                    <th style="border: 1px solid black; padding: 6pt; text-align: center; width: 8%;">STT</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: left; width: 52%;">Tên tài sản, trang thiết bị</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: center; width: 10%;">ĐVT</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: center; width: 10%;">Số lượng</th>
                                    <th style="border: 1px solid black; padding: 6pt; text-align: left; width: 20%;">Ghi chú (S/N)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items && items.length > 0 ? items.map((item: any, idx: number) => `
                                    <tr>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: center;">${idx + 1}</td>
                                        <td style="border: 1px solid black; padding: 6pt;">${item.name || item.description || 'N/A'}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: center;">${item.unit || 'Cái'}</td>
                                        <td style="border: 1px solid black; padding: 6pt; text-align: center;">${item.quantity || 1}</td>
                                        <td style="border: 1px solid black; padding: 6pt;">${item.serial || item.note || '-'}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="5" style="border: 1px solid black; padding: 12pt; text-align: center; color: #64748b;">Không có chi tiết trang thiết bị</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>

                        <p>Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản làm căn cứ thực hiện.</p>

                        <table style="width: 100%; border: none; margin-top: 36pt; margin-bottom: 36pt;">
                            <tr>
                                <td style="border: none; text-align: center; width: 50%;">
                                    <strong>ĐẠI DIỆN BÊN GIAO</strong><br/>
                                    <span style="font-size: 9pt; font-style: italic;">(Ký, ghi rõ họ tên)</span>
                                    <br/><br/><br/><br/>
                                    <strong>${metadata.giver_name || '...'}</strong>
                                </td>
                                <td style="border: none; text-align: center; width: 50%;">
                                    <strong>ĐẠI DIỆN BÊN NHẬN</strong><br/>
                                    <span style="font-size: 9pt; font-style: italic;">(Ký, ghi rõ họ tên)</span>
                                    <br/><br/><br/><br/>
                                    <strong>${metadata.receiver_name || '...'}</strong>
                                </td>
                            </tr>
                        </table>
                    `;
                } else {
                    const metadata = data.metadata || {};
                    const keys = Object.keys(metadata);
                    
                    docBody = `
                        <div style="text-align: center; margin-bottom: 18pt;">
                            <span style="font-size: 14pt; font-weight: bold; display: block;">${docType.toUpperCase()}</span>
                        </div>

                        ${keys.length > 0 ? `
                            <h4>THÔNG TIN CHÍNH TRÍCH XUẤT (METADATA)</h4>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 18pt;">
                                ${keys.map(k => `
                                    <tr>
                                        <td style="border: 1px solid black; padding: 6pt; width: 30%; background-color: #f8fafc; font-weight: bold;">${k}</td>
                                        <td style="border: 1px solid black; padding: 6pt; width: 70%;">${typeof metadata[k] === 'object' ? JSON.stringify(metadata[k]) : metadata[k]}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        ` : ''}

                        <h4>NỘI DUNG VĂN BẢN CHI TIẾT</h4>
                        <div style="text-align: justify; line-height: 1.6;">
                            ${ocrRes.raw_text.split('\n').map((line: string) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join('')}
                        </div>
                    `;
                }

                const htmlContent = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <title>${baseName}</title>
                    <meta charset="utf-8">
                    <!--[if gte mso 9]>
                    <xml>
                        <w:WordDocument>
                            <w:View>Print</w:View>
                            <w:Zoom>100</w:Zoom>
                        </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
                        p { margin-bottom: 6pt; text-align: justify; }
                        table { border-collapse: collapse; width: 100%; margin-top: 12pt; }
                        th, td { border: 1px solid black; padding: 6pt; font-size: 10pt; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                    </style>
                </head>
                <body>
                    ${docBody}
                </body>
                </html>
                `;

                res.setHeader('Content-Type', 'application/msword');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseName)}.doc"`);
                return res.status(200).send(htmlContent);
            }

            return res.status(400).json({ error: 'Định dạng tải xuống không hỗ trợ (chỉ hỗ trợ txt, docx, json)' });
        }

        return res.status(400).json({ error: 'Tham số type không hợp lệ' });
    } catch (err: any) {
        console.error('[OCR API Error]:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}
