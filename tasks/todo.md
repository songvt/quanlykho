# Tasks: Phân hệ Kỳ thi – Vật tư

## Task 1: Schema and transaction contract ✅

**Description:** Thêm types, migration bảng `exam_*`, constraint và RPC tạo/hủy phiếu độc lập với kho GGS.

**Acceptance criteria:**
- [x] Tất cả bảng/unique constraint mới được tạo theo spec, không sửa bảng GGS hiện có.
- [x] RPC không cho số lượng tồn âm và hủy chỉ hoàn tồn một lần.
- [x] RPC yêu cầu idempotency key hợp lệ cho thao tác tạo/hủy.

**Verification:**
- [x] Test: `npx tsx --test tests/exam-campaigns.test.ts`
- [x] Build: `npm run build`
- [ ] Manual: kiểm tra schema migration trên Supabase staging (chờ chạy migration được duyệt).

**Dependencies:** None

**Files likely touched:**
- `migrations/<timestamp>_exam_campaigns.sql`
- `src/types/examCampaigns.ts`
- `tests/exam-campaigns.test.ts`

**Estimated scope:** Medium

## Task 2: Campaign and site API slice

**Description:** Thêm API và typed client quản lý chiến dịch/điểm trường sau session và permission boundary của GGS.

**Acceptance criteria:**
- [ ] Có thể CRUD chiến dịch/điểm trường theo quyền đã định.
- [ ] Validation/error response nhất quán; không lộ lỗi nội bộ.
- [ ] Danh sách hỗ trợ lọc/trang khi cần.

**Verification:**
- [ ] Test: `tsx --test tests/exam-campaigns.test.ts`
- [ ] Build: `npm run build`
- [ ] Manual: gọi API bằng session hợp lệ và không hợp lệ.

**Dependencies:** Task 1

**Files likely touched:**
- `api_handlers/exam_campaigns.ts`
- `api/index.ts`
- `server.ts`
- `src/services/examCampaigns.ts`

**Estimated scope:** Medium

## Task 3: Campaign inventory API slice

**Description:** Thêm API/client để nhập, sửa và xem vật tư độc lập theo chiến dịch.

**Acceptance criteria:**
- [ ] Mã vật tư chỉ duy nhất trong một chiến dịch, không gọi `products`.
- [ ] Không nhận số lượng âm hoặc dữ liệu không hợp lệ.
- [ ] Luồng GGS hiện có không bị sửa.

**Verification:**
- [ ] Test: `tsx --test tests/exam-campaigns.test.ts`
- [ ] Build: `npm run build`
- [ ] Manual: thêm cùng mã vật tư ở hai chiến dịch khác nhau.

**Dependencies:** Tasks 1-2

**Files likely touched:**
- `api_handlers/exam_campaigns.ts`
- `src/services/examCampaigns.ts`
- `tests/exam-campaigns.test.ts`

**Estimated scope:** Small

## Checkpoint: Foundation

- [ ] `npm test`, `npm run lint`, `npm run build` pass.
- [ ] Review migration and API contract before UI implementation.

## Task 4: Export and admin-cancellation API slice

**Description:** Tạo/hủy phiếu thông qua RPC và kiểm tra nhân sự nhận từ GGS.

**Acceptance criteria:**
- [ ] Xuất nhiều dòng không vượt tồn, có số phiếu và lịch sử.
- [ ] Retry cùng key không tạo phiếu thứ hai; reuse key khác payload trả 409.
- [ ] Chỉ admin hủy được, hủy nhiều lần không hoàn tồn lặp.

**Verification:**
- [ ] Test: `tsx --test tests/exam-campaigns.test.ts`
- [ ] Build: `npm run build`
- [ ] Manual: thử hai yêu cầu xuất cạnh tranh trên một dòng tồn.

**Dependencies:** Tasks 1-3

**Files likely touched:**
- `api_handlers/exam_campaigns.ts`
- `src/services/examCampaigns.ts`
- `tests/exam-campaigns.test.ts`
- `migrations/<timestamp>_exam_campaigns.sql`

**Estimated scope:** Medium

## Task 5: Campaign management UI slice

**Description:** Thêm route/menu và màn hình quản lý chiến dịch, điểm trường, vật tư.

**Acceptance criteria:**
- [ ] Mục menu mới chỉ thêm vào nhóm Xuất nhập kho, không thay đổi mục cũ.
- [ ] Có loading, empty, error và permission states.
- [ ] Dùng được ở 320px, 768px, 1024px và desktop.

**Verification:**
- [ ] Test: `npm run lint`
- [ ] Build: `npm run build`
- [ ] Manual: tab qua form, tạo chiến dịch/điểm trường/vật tư.

**Dependencies:** Tasks 2-3

**Files likely touched:**
- `src/App.tsx`
- `src/components/Layout/ModernSidebar.tsx`
- `src/pages/ExamCampaigns/ExamCampaignsPage.tsx`
- `src/components/ExamCampaigns/CampaignForm.tsx`
- `src/components/ExamCampaigns/CampaignInventoryTable.tsx`

**Estimated scope:** Medium

## Task 6: Export UI slice

**Description:** Thêm form lập phiếu, chọn nhân sự GGS, lịch sử và admin-only cancellation.

**Acceptance criteria:**
- [ ] Nhân sự chỉ được đọc từ service GGS và không có thao tác sửa nhân sự.
- [ ] Form chặn dữ liệu sai trước khi gọi API, nhưng server vẫn là nơi quyết định.
- [ ] Chức năng hủy không hiển thị/không hoạt động với non-admin.

**Verification:**
- [ ] Test: `npm run lint`
- [ ] Build: `npm run build`
- [ ] Manual: tạo phiếu và xác minh tồn/lịch sử cập nhật.

**Dependencies:** Tasks 4-5

**Files likely touched:**
- `src/pages/ExamCampaigns/ExamCampaignsPage.tsx`
- `src/components/ExamCampaigns/ExportForm.tsx`
- `src/components/ExamCampaigns/ExportHistory.tsx`
- `src/store/slices/employeesSlice.ts`

**Estimated scope:** Medium

## Checkpoint: Delivery flow

- [ ] Luồng campaign → inventory → export hoạt động end-to-end.
- [ ] Không thể xuất âm; chỉ admin hủy phiếu.
- [ ] `npm test`, `npm run lint`, `npm run build` pass.

## Task 7: Handover print slice

**Description:** Port mẫu biên bản hiện tại của ứng dụng nguồn để xem trước và in phiếu GGS.

**Acceptance criteria:**
- [ ] Biên bản có đúng chiến dịch, điểm trường, người nhận, vật tư và số phiếu.
- [ ] Nội dung được escape khi render HTML.
- [ ] Bản in A4 hoạt động trong trình duyệt hiện đại.

**Verification:**
- [ ] Test: `tsx --test tests/exam-campaigns.test.ts`
- [ ] Build: `npm run build`
- [ ] Manual: print preview từ một phiếu đã tạo.

**Dependencies:** Tasks 4 and 6

**Files likely touched:**
- `src/components/ExamCampaigns/HandoverPrint.tsx`
- `src/utils/examCampaignPrint.ts`
- `src/components/ExamCampaigns/ExportHistory.tsx`
- `tests/exam-campaigns.test.ts`

**Estimated scope:** Medium

## Task 8: Regression and release readiness

**Description:** Hoàn tất test API/RPC/UI logic, rà soát menu/permission và chuẩn bị migration phát hành.

**Acceptance criteria:**
- [ ] Các test mới kiểm tra validation, idempotency, tồn âm và admin-only cancellation.
- [ ] Full suite, lint và build pass.
- [ ] Có hướng dẫn chạy migration và rollback không phá dữ liệu hiện hữu.

**Verification:**
- [ ] Test: `npm test`
- [ ] Lint: `npm run lint`
- [ ] Build: `npm run build`

**Dependencies:** Tasks 1-7

**Files likely touched:**
- `tests/exam-campaigns.test.ts`
- `SPEC-exam-campaign-inventory.md`
- `tasks/plan.md`

**Estimated scope:** Small

## Checkpoint: Complete

- [ ] All success criteria from `SPEC-exam-campaign-inventory.md` are met.
- [ ] Production migration execution has explicit approval.
