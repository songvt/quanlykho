# Implementation Plan: Phân hệ Kỳ thi – Vật tư

## Overview

Xây một phân hệ độc lập ở `APP_QL_KHO - GGS` để quản lý chiến dịch, điểm trường, vật tư theo chiến dịch, xuất bàn giao và in biên bản. Phân hệ dùng session, UI và dữ liệu nhân sự sẵn có của GGS; không thay đổi bất kỳ bảng hoặc luồng kho hiện tại nào.

Specification: [`SPEC-exam-campaign-inventory.md`](../SPEC-exam-campaign-inventory.md)

## Architecture Decisions

- Dữ liệu mới là additive, nằm trong các bảng `exam_*`; không tái sử dụng `products`, `transactions` hay tồn kho GGS.
- Server API là ranh giới duy nhất cho thao tác ghi. Frontend không gọi Supabase trực tiếp.
- Các thao tác tạo/hủy phiếu dùng PostgreSQL RPC để khóa tồn và xử lý nguyên tử; hủy chỉ cho `admin`.
- Nhân sự được đọc qua client/service hiện có của GGS, với API vẫn xác thực người nhận tồn tại tại thời điểm lập phiếu.
- Bố cục biên bản được port từ `E:\APP_AGENT\THI_TOTNGHIEP\src\lib\pdf.ts`, nhưng tách thành component/print utility của GGS và không mang theo storage/upload của app nguồn.

## Dependency Graph

```text
Migration + RPC + types
    ├── API: campaigns/sites ──────────┐
    ├── API: campaign inventory ───────┼── API client ── UI routes/menu
    └── API: exports/cancellation ─────┘                    └── print preview
```

## Task List

### Phase 1: Foundation

1. `schema-contract`: thêm kiểu dữ liệu phân hệ, migration bảng mới, constraint và RPC tạo/hủy phiếu.
2. `campaign-sites-api`: thêm handler/API client cho chiến dịch và điểm trường, kiểm tra session + quyền.
3. `campaign-inventory-api`: thêm handler/API client cho vật tư độc lập theo chiến dịch, kiểm tra số lượng hợp lệ.

### Checkpoint: Foundation

- Migration chạy được trong môi trường kiểm thử/staging.
- `npm test`, `npm run lint`, `npm run build` thành công.
- Không có diff ở bảng/route kho hiện hữu.

### Phase 2: Delivery flow

4. `campaign-export-api`: thêm lập phiếu, idempotency, khóa/trừ tồn và hủy phiếu chỉ admin.
5. `campaign-management-ui`: thêm route, menu và giao diện quản lý chiến dịch/điểm trường/vật tư.
6. `campaign-export-ui`: thêm form xuất, chọn nhân sự GGS/điểm trường, lịch sử phiếu và quyền hủy.

### Checkpoint: Delivery flow

- Người dùng có quyền hoàn tất tạo chiến dịch → thêm vật tư → xuất cho nhân sự GGS.
- Không thể xuất quá tồn; chỉ admin nhìn/thực hiện hủy.
- Các màn hình GGS hiện hữu vẫn truy cập bình thường.

### Phase 3: Print and hardening

7. `handover-print`: port mẫu biên bản hiện tại thành xem trước/in trong phân hệ mới.
8. `campaign-regression-tests`: bổ sung test contract/RPC/UI logic và kiểm tra regression cuối.

### Checkpoint: Complete

- `npm test`, `npm run lint`, `npm run build` thành công.
- Kiểm tra thủ công desktop/mobile: menu, loading/error/empty state, keyboard, in biên bản.
- Migration production chỉ được chạy sau khi người dùng xác nhận riêng.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cạnh tranh khi hai người xuất cùng vật tư | Cao | RPC khóa dòng, `quantity_available >= quantity`, transaction nguyên tử và test đồng thời |
| Retry tạo/hủy phiếu | Cao | `Idempotency-Key`, unique constraint và lưu request hash/kết quả |
| Khóa nhân sự GGS không thống nhất | Trung bình | Kiểm tra `employees`/`hr_profiles` trong migration và API trước khi chọn kiểu foreign key |
| Mẫu biên bản nguồn chứa phụ thuộc Next.js | Thấp | Chỉ port markup/style cần thiết, dùng dữ liệu typed của GGS |
| Ảnh hưởng luồng GGS hiện hữu | Cao | Chỉ thêm file/route/menu; không sửa API hoặc bảng kho cũ; kiểm tra regression sau mỗi lát cắt |

## Rollout and Rollback

- Triển khai code trước khi bật menu production; menu được bảo vệ bởi quyền có sẵn.
- Chạy migration mới duy nhất ở bước phát hành đã được phê duyệt.
- Rollback ứng dụng: revert commit phân hệ. Rollback dữ liệu: giữ bảng mới, tắt menu/API; không xóa dữ liệu/không can thiệp tồn kho GGS.

## Open Questions

Không còn câu hỏi nghiệp vụ. Việc chạy migration vào Supabase production cần được duyệt riêng ngay trước khi phát hành.
