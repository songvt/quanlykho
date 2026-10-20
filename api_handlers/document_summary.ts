import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function documentSummaryHandler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { fileName, mimeType, text, fileBase64, slideImages, mode } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY để tóm tắt tài liệu.' });
    }

    const editablePptxMode = mode === 'pptx-editable';
    if (!fileName || (!text && !fileBase64 && !Array.isArray(slideImages))) {
        return res.status(400).json({ error: 'Vui lòng gửi nội dung hoặc tệp tài liệu.' });
    }
    if (typeof text === 'string' && text.length > 100000) {
        return res.status(400).json({ error: 'Nội dung tài liệu quá dài. Vui lòng chọn tài liệu dưới 100.000 ký tự.' });
    }
    if (typeof fileBase64 === 'string' && fileBase64.length > 13_500_000) {
        return res.status(400).json({ error: 'Tệp PDF quá lớn. Vui lòng chọn tệp dưới 10 MB.' });
    }

    if (editablePptxMode) {
        if (!Array.isArray(slideImages) || !slideImages.length || slideImages.length > 30) {
            return res.status(400).json({ error: 'Không đọc được ảnh của các slide PowerPoint hoặc số slide vượt quá giới hạn 30.' });
        }
        if (slideImages.some((slide: any) => typeof slide?.data !== 'string' || slide.data.length > 8_000_000)) {
            return res.status(400).json({ error: 'Dữ liệu slide không hợp lệ hoặc quá lớn.' });
        }
        const instruction = `Bạn là chuyên gia phục dựng PowerPoint. Các ảnh đính kèm là các slide của tệp "${fileName}". Hãy đọc TỪNG slide bằng OCR, giữ nguyên ngôn ngữ, số liệu, đơn vị và ý nghĩa. Mục tiêu là tạo lại một PowerPoint có thể chỉnh sửa, do đó không mô tả ảnh nền hoặc logo, không giữ logo Gemini/NotebookLM, không chèn nội dung tưởng tượng.

Trả về DUY NHẤT JSON hợp lệ, không Markdown, không dùng code fence, theo cấu trúc:
{"slides":[{"title":"...","subtitle":"... hoặc rỗng","theme":"light|dark","blocks":[{"heading":"... hoặc rỗng","items":["..."],"kind":"text|callout|table"}]}]}

Quy tắc bắt buộc:
- Số lượng phần tử slides phải đúng bằng số ảnh đầu vào và theo đúng thứ tự.
- Mỗi câu, số, đơn vị, điều kiện, ghi chú nhìn thấy cần xuất hiện ở title, subtitle, heading hoặc items.
- Với bảng, dùng kind "table"; mỗi item là một hàng văn bản, giữ nhãn cột trong heading nếu có.
- Tách thông tin thành 2–5 block theo bố cục slide. Bỏ qua toàn bộ watermark/logo Gemini NotebookLM.
- Không viết phần nhận xét, không tóm tắt, không sửa số liệu.
- Nếu chữ quá nhỏ hoặc không rõ, ghi [Cần xác minh] thay vì đoán.`;

        const parts: Array<Record<string, unknown>> = [{ text: instruction }];
        slideImages.forEach((slide: { data: string; mimeType?: string }, index: number) => {
            parts.push({ text: `\nSLIDE ${index + 1}:` });
            parts.push({ inlineData: { mimeType: slide.mimeType || 'image/png', data: slide.data } });
        });

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: 16384, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } })
            });
            if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'AI đang quá tải, vui lòng thử lại sau.' : 'Không thể đọc các slide PowerPoint lúc này.' });
            const data = await response.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, '').trim());
            if (!Array.isArray(parsed.slides) || parsed.slides.length !== slideImages.length) throw new Error('Kết quả nhận diện slide chưa đầy đủ.');
            return res.status(200).json({ editableSlides: parsed.slides });
        } catch (error) {
            console.error('Editable PPTX conversion error:', error);
            return res.status(502).json({ error: 'Không thể tạo bản PowerPoint chỉnh sửa được. Vui lòng thử lại.' });
        }
    }

    const instruction = `Bạn là chuyên gia cấp cao về phân tích tài liệu, biên tập nội dung và thiết kế bài thuyết trình doanh nghiệp. Hãy đọc kỹ tài liệu "${fileName}", xác định thông điệp cốt lõi và chuyển hóa nó thành bộ nội dung sẵn sàng cho buổi trình bày 10–15 phút. Không sao chép dài dòng, không chỉ đưa ra một đoạn tóm tắt ngắn, và không tự tạo dữ kiện.

Trả lời bằng tiếng Việt, dùng Markdown, theo cấu trúc bắt buộc sau:

## A. Báo cáo phân tích tài liệu
Nêu chủ đề, mục tiêu, đối tượng áp dụng/người nghe, thông điệp trung tâm và 3–5 phát hiện quan trọng. Sau đó phân tích các nội dung chính theo chương/mục thực tế: bối cảnh, phạm vi, dữ liệu/thực trạng, quy định hoặc giải pháp, trách nhiệm, rủi ro và kiến nghị. Mỗi ý phải giải thích đủ nghĩa, không ghi chung chung.

## B. Số liệu, mốc và thông tin cần xác minh
Liệt kê chính xác số hiệu, tên riêng, mốc thời gian, đơn vị đo, định mức, căn cứ/phụ lục/biểu mẫu. Nêu riêng các thông tin thiếu, khó đọc hoặc cần xác minh; nếu không có thì ghi rõ.

## C. Dàn ý bài thuyết trình
Đề xuất số slide phù hợp với độ dài tài liệu (thường 6–10 slide), trình tự logic và mục tiêu của từng phần. Ưu tiên tiêu đề thể hiện thông điệp/kết luận, không dùng tiêu đề chung chung.

## D. Nội dung chi tiết từng slide
Với MỖI slide, trình bày đầy đủ theo mẫu:
### Slide [số] — [tiêu đề thể hiện thông điệp]
- **Thông điệp chính:**
- **Nội dung hiển thị:** 2–5 gạch đầu dòng ngắn gọn, chính xác.
- **Số liệu/dẫn chứng:** trích từ tài liệu nếu có.
- **Gợi ý bố cục trực quan:** biểu đồ, sơ đồ quy trình, timeline, bảng so sánh hoặc ảnh minh họa phù hợp; chỉ đề xuất khi giúp người nghe hiểu rõ hơn.
- **Ghi chú lời thoại:** 2–4 câu tự nhiên cho người trình bày, kèm câu chuyển tiếp khi phù hợp.
- **Nguồn trong tài liệu:** chương/mục/trang nếu xác định được.

## E. Kết luận và hành động tiếp theo
Nêu các việc cần phổ biến, triển khai hoặc quyết định sau buổi trình bày.

## F. Kiểm tra chất lượng
Xác nhận ngắn gọn: số liệu/đơn vị đã giữ đúng, phần nào chưa đủ căn cứ, và các điểm cần người dùng duyệt trước khi sử dụng chính thức.

Yêu cầu hoàn tất: PHẢI tạo đủ sáu phần A, B, C, D, E và F theo đúng thứ tự trước khi kết thúc. Không được dừng sau lời chào, phần A hoặc vài gạch đầu dòng đầu tiên. Phần D phải có đầy đủ tất cả slide đã đề xuất ở phần C. Nếu giới hạn độ dài buộc phải rút gọn, hãy rút gọn câu chữ của từng gạch đầu dòng nhưng vẫn liệt kê đủ toàn bộ phần và slide.

Nguyên tắc: mỗi slide chỉ tập trung một thông điệp; giữ nguyên ý nghĩa và số liệu nguồn; phân biệt dữ kiện với đề xuất; không suy đoán. Nếu tài liệu không đọc được hoặc thiếu trang, nói rõ phần thiếu thay vì bịa nội dung.`;

    const parts: Array<Record<string, unknown>> = [{ text: instruction }];
    if (typeof text === 'string' && text.trim()) parts.push({ text: `\nNỘI DUNG TÀI LIỆU:\n${text.trim()}` });
    if (typeof fileBase64 === 'string') parts.push({ inlineData: { mimeType: mimeType || 'application/pdf', data: fileBase64 } });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
            })
        });
        if (!response.ok) {
            const details = await response.text();
            console.error('Document summary failed:', details);
            return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'AI đang quá tải, vui lòng thử lại sau.' : 'Không thể tóm tắt tài liệu lúc này.' });
        }
        const data = await response.json();
        return res.status(200).json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được nội dung tóm tắt.' });
    } catch (error) {
        console.error('Document summary error:', error);
        return res.status(500).json({ error: 'Lỗi kết nối dịch vụ tóm tắt.' });
    }
}
