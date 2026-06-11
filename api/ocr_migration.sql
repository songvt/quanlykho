-- OCR Documents System Migration Script

-- 1. Bảng upload_files: Lưu trữ thông tin hình ảnh/tệp tài liệu tải lên
CREATE TABLE IF NOT EXISTS upload_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,       -- Đường dẫn tương đối lưu trữ trong Supabase Storage
  file_size INTEGER NOT NULL,    -- Kích thước tệp (bytes)
  mime_type TEXT NOT NULL,       -- Ví dụ: 'image/jpeg', 'image/png'
  enhanced_path TEXT,            -- Đường dẫn ảnh sau khi deskew/crop/contrast
  status TEXT DEFAULT 'uploaded', -- 'uploaded', 'enhancing', 'enhanced', 'processing', 'completed', 'failed'
  sort_order INTEGER DEFAULT 0,  -- Để sắp xếp thứ tự các trang khi ghép PDF
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng ocr_results: Lưu văn bản trích xuất và cấu trúc JSON từ AI
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES upload_files(id) ON DELETE CASCADE,
  raw_text TEXT,                 -- Văn bản thô đầy đủ
  structured_data JSONB,         -- Cấu trúc JSON trích xuất tự động (hóa đơn, biên bản, phiếu cân,...)
  language TEXT DEFAULT 'vi',    -- Ngôn ngữ chính phát hiện ('vi', 'en',...)
  confidence NUMERIC DEFAULT 0,  -- Độ chính xác ước tính từ AI (%)
  engine TEXT DEFAULT 'gemini',  -- Công cụ OCR ('gemini', 'tesseract',...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng pdf_documents: Quản lý các file PDF hoàn thiện được xuất ra
CREATE TABLE IF NOT EXISTS pdf_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  pdf_path TEXT NOT NULL,        -- Đường dẫn lưu trên Supabase Storage
  is_searchable BOOLEAN DEFAULT TRUE, -- PDF có thể tìm kiếm từ khóa (chứa lớp text ẩn)
  page_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng processing_logs: Nhật ký hoạt động OCR và bảo mật
CREATE TABLE IF NOT EXISTS processing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,          -- 'upload', 'enhance', 'ocr_process', 'export_pdf', 'download'
  status TEXT NOT NULL,          -- 'success', 'failed'
  details TEXT,                  -- Chi tiết thông điệp hoặc lỗi
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật Row Level Security (RLS) cho tất cả các bảng
ALTER TABLE upload_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Cấu hình RLS Policies (Cho phép người dùng đã xác thực tương tác)
-- upload_files
CREATE POLICY "Allow select upload_files for authenticated users" 
  ON upload_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert upload_files for authenticated users" 
  ON upload_files FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow update upload_files for authenticated users" 
  ON upload_files FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete upload_files for authenticated users" 
  ON upload_files FOR DELETE TO authenticated USING (true);

-- ocr_results
CREATE POLICY "Allow select ocr_results for authenticated users" 
  ON ocr_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert ocr_results for authenticated users" 
  ON ocr_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update ocr_results for authenticated users" 
  ON ocr_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete ocr_results for authenticated users" 
  ON ocr_results FOR DELETE TO authenticated USING (true);

-- pdf_documents
CREATE POLICY "Allow select pdf_documents for authenticated users" 
  ON pdf_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert pdf_documents for authenticated users" 
  ON pdf_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow update/delete pdf_documents for admin/owner" 
  ON pdf_documents FOR ALL TO authenticated USING (true);

-- processing_logs
CREATE POLICY "Allow select processing_logs for authenticated users" 
  ON processing_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert processing_logs for authenticated users" 
  ON processing_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Tạo Index tăng hiệu năng truy vấn
CREATE INDEX IF NOT EXISTS idx_upload_files_user_id ON upload_files (user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_file_id ON ocr_results (file_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_user_id ON pdf_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_user_id ON processing_logs (user_id);
