# Spec: Phân hệ Kỳ thi – Vật tư theo chiến dịch

## Objective

Thêm một phân hệ độc lập vào ứng dụng `APP_QL_KHO - GGS` để quản lý vật tư phục vụ từng chiến dịch/kỳ thi, điểm trường và biên bản bàn giao. Phân hệ xuất hiện trong menu **Xuất nhập kho** với tên **Kỳ thi – vật tư**.

Người dùng có quyền phù hợp có thể:

1. Tạo và chọn chiến dịch.
2. Quản lý điểm trường thuộc chiến dịch.
3. Nhập danh mục/số lượng vật tư theo chiến dịch.
4. Lập phiếu xuất vật tư cho nhân sự GGS và điểm trường; không được xuất vượt tồn.
5. In biên bản bàn giao từ phiếu xuất.

`employees` và `hr_profiles` của GGS là nguồn nhân sự duy nhất. Phân hệ này không tạo, sửa, sao chép hoặc đồng bộ ngược dữ liệu nhân sự.

## Assumptions

1. Dữ liệu mới được lưu tại Supabase của GGS, không dùng Supabase của ứng dụng nguồn.
2. Vật tư của chiến dịch là tồn nghiệp vụ riêng; không làm thay đổi tồn kho, giao dịch hay báo cáo của các bảng `products`, `transactions`, `orders` hiện hữu.
3. Quyền truy cập v1 dùng các quyền kho hiện có: xem với `inventory.view`, tạo/sửa/xuất với `inventory.manage` hoặc `outbound.create`; chỉ `admin` được hủy phiếu đã phát hành.
4. Biên bản in kế thừa mẫu biên bản đang dùng trong ứng dụng nguồn; v1 xem trước và in bằng trình duyệt, chưa lưu PDF hoặc upload file.

## Scope

## Isolation Guarantee

Phân hệ Kỳ thi – Vật tư là một module độc lập. Mọi thay đổi phải tuân thủ các điều kiện sau:

- Chỉ thêm bảng `exam_*`/`campaign_*`, endpoint `/api/exam-campaigns`, route và menu mới.
- Không sửa cấu trúc, dữ liệu, RPC, quyền hoặc hành vi của `products`, `transactions`, `orders`, `assets`, `employees`, `hr_profiles` hay các báo cáo hiện hữu.
- Không chạy migration production, đổi biến môi trường hoặc công khai menu cho người dùng cho đến khi có phê duyệt riêng.
- Mỗi lát cắt phải chạy regression `npm test`, `npm run lint`, `npm run build`; nếu phát hiện ảnh hưởng, dừng triển khai và báo lại thay vì sửa lan sang module đang chạy.

### In scope

- Menu, route và giao diện responsive của phân hệ mới.
- Chiến dịch, điểm trường, vật tư chiến dịch, phiếu xuất và dòng chi tiết phiếu.
- Tìm/chọn người nhận từ nhân sự GGS.
- Kiểm tra tồn, giao dịch xuất nguyên tử và lịch sử phiếu.
- Xem trước và in biên bản bàn giao.
- Migration bổ sung, API tách riêng và kiểm thử nghiệp vụ.

### Out of scope

- Chấm công, Zalo, tài sản, import nhân sự và các màn hình khác của app nguồn.
- Thay đổi cấu trúc hoặc dữ liệu của các bảng kho GGS hiện có.
- Đồng bộ hai chiều với ứng dụng nguồn.
- Chỉnh sửa phiếu sau khi đã in/phát hành; v1 dùng hủy phiếu để hoàn tồn.

## Module Boundary

| Module | Responsibility | Depends on |
|---|---|---|
| `campaigns` | Chiến dịch và điểm trường | GGS auth |
| `campaign-inventory` | Vật tư và số lượng tồn theo chiến dịch | `campaigns` |
| `campaign-exports` | Phiếu xuất, chi tiết, trừ/hoàn tồn và biên bản | `campaigns`, `campaign-inventory`, GGS HR |

Build order: `campaigns` → `campaign-inventory` → `campaign-exports`.

## Data Model

Các bảng mới đều có cột `id uuid`, `created_at`, `updated_at` và không có foreign key tới bảng vật tư/kho hiện hữu.

| Table | Key fields | Rules |
|---|---|---|
| `exam_campaigns` | `campaign_code`, `campaign_name`, `description`, `status` | `campaign_code` duy nhất; `DRAFT`, `ACTIVE`, `CLOSED` |
| `exam_sites` | `campaign_id`, `site_code`, `site_name`, `address`, `contact_name`, `contact_phone` | mã điểm trường duy nhất trong mỗi chiến dịch |
| `campaign_inventory_items` | `campaign_id`, `item_code`, `item_name`, `unit`, `quantity_received`, `quantity_available`, `serial_numbers` | tồn khả dụng không âm; mã vật tư chỉ có ý nghĩa trong chiến dịch, không liên kết `products` |
| `campaign_export_documents` | `document_number`, `campaign_id`, `site_id`, `recipient_employee_id`, `export_date`, `status`, `notes`, `created_by` | số phiếu duy nhất; `ISSUED` hoặc `CANCELLED` |
| `campaign_export_lines` | `document_id`, `inventory_item_id`, `quantity`, `serial_numbers` | số lượng dương |

`recipient_employee_id` tham chiếu nhân sự GGS theo mã nhân viên/UUID đang được ứng dụng dùng. Migration phải xác minh kiểu khóa thực tế trước khi đặt foreign key; nếu hai nguồn nhân sự không thống nhất kiểu khóa, chỉ lưu mã nhân sự và ràng buộc ở API.

## API Contract

Tất cả endpoint mới đặt dưới `/api/exam-campaigns`. Chúng sử dụng app session hiện có, xác thực quyền tại server và trả lỗi theo một dạng thống nhất:

```ts
type ApiError = {
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';
    message: string;
    details?: unknown;
  };
};
```

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/exam-campaigns` | Liệt kê chiến dịch, phân trang/lọc trạng thái |
| `POST` | `/api/exam-campaigns` | Tạo chiến dịch |
| `PATCH` | `/api/exam-campaigns/:id` | Cập nhật chiến dịch |
| `GET/POST` | `/api/exam-campaigns/:id/sites` | Liệt kê/tạo điểm trường |
| `GET/POST` | `/api/exam-campaigns/:id/items` | Liệt kê/nhập vật tư chiến dịch |
| `GET/POST` | `/api/exam-campaigns/:id/exports` | Liệt kê/lập phiếu xuất |
| `POST` | `/api/exam-campaigns/:id/exports/:documentId/cancel` | Admin hủy phiếu, hoàn tồn một lần |

Tạo/hủy phiếu phải dùng RPC/PostgreSQL transaction. Tạo phiếu khóa các dòng vật tư, xác nhận tồn, tạo header + lines và trừ tồn trong cùng transaction. `Idempotency-Key` bắt buộc cho tạo/hủy phiếu; cùng key nhưng nội dung khác phải trả `409 CONFLICT`.

## UI Design

- Thêm mục **Kỳ thi – vật tư** trong menu con **Xuất nhập kho**, không làm thay đổi các mục hiện hữu.
- Trang tổng quan chiến dịch có bộ chọn chiến dịch, số liệu tồn, số điểm trường và số phiếu đã lập.
- Tabs: `Điểm trường`, `Vật tư`, `Xuất bàn giao`, `Lịch sử & in biên bản`.
- Form sử dụng MUI hiện có, label rõ ràng, trạng thái loading/empty/error, thao tác hoàn toàn bằng bàn phím.
- Ở màn hình nhỏ, bảng có cuộn ngang; chức năng in mở khung xem trước rồi gọi print của trình duyệt.

## Project Structure

```text
src/pages/ExamCampaigns/              # route/container và các màn hình phân hệ
src/components/ExamCampaigns/         # form, bảng và bản in biên bản
src/services/examCampaigns.ts         # API client có kiểu dữ liệu
src/types/examCampaigns.ts            # input/output contracts
api_handlers/exam_campaigns.ts        # boundary validation + authorization
migrations/<timestamp>_exam_campaigns.sql
tests/exam-campaigns.test.ts          # nghiệp vụ + contract
```

## Code Style

Theo TypeScript, React, MUI và cấu trúc API hiện có. Dữ liệu ngoài biên API được kiểm tra trước khi xử lý; component trình bày không gọi Supabase trực tiếp.

```ts
export interface CreateCampaignExportInput {
  siteId: string;
  recipientEmployeeId: string;
  exportDate: string;
  lines: Array<{ inventoryItemId: string; quantity: number; serialNumbers?: string }>;
  notes?: string;
}
```

## Commands

```bash
npm test
npm run lint
npm run build
npm run dev
```

## Testing Strategy

- Unit/contract test: validate input, permission, số phiếu, trạng thái và idempotency.
- Database/RPC integration test: không xuất vượt tồn; hủy phiếu chỉ hoàn tồn một lần; hai yêu cầu đồng thời không tạo tồn âm.
- UI test thủ công: menu, chọn nhân sự GGS, chọn điểm trường, lập phiếu, xem trước/in.
- Regression: chạy `npm test`, `npm run lint`, `npm run build`; kiểm tra các route kho hiện hữu không thay đổi.

## Boundaries

- Always: thêm theo kiểu additive; kiểm tra quyền server-side; chạy test/lint/build; không log token hoặc dữ liệu nhạy cảm.
- Ask first: chạy migration vào Supabase production, thêm dependency, thay đổi permission schema hay menu mobile.
- Never: sửa bảng/kho dữ liệu hiện hữu của GGS để chứa dữ liệu kỳ thi; truy cập Supabase của app nguồn từ client; thay đổi hoặc tắt cơ chế session hiện có.

## Success Criteria

1. Nhân sự trên phiếu chỉ lấy từ dữ liệu GGS và không có thao tác ghi vào nhân sự.
2. Người dùng có quyền có thể quản lý chiến dịch/điểm trường/vật tư và lập phiếu xuất theo chiến dịch.
3. Không thể xuất âm tồn hoặc tạo trùng phiếu bởi retry.
4. Biên bản hiển thị đúng chiến dịch, điểm trường, người nhận, danh sách vật tư và được in từ trình duyệt.
5. Toàn bộ luồng kho, tài sản, đơn hàng và báo cáo hiện hữu vẫn qua test/build như trước.

## Open Questions

Không còn câu hỏi mở cho phiên bản đầu tiên. Mọi thay đổi quy trình hủy, liên kết danh mục vật tư hoặc mẫu biên bản sẽ được ghi nhận thành yêu cầu mới trước khi triển khai.
