/**
 * Outbound module — barrel exports
 *
 * Sub-components đã được tách ra:
 *   - StockDisplay.tsx        → Chip hiển thị tồn kho (tái sử dụng được toàn app)
 *   - outboundTelegram.ts     → Gửi thông báo Telegram
 *   - FulfillOrderDialog.tsx  → Dialog xác nhận xuất kho theo đơn (Staff)
 *   - StaffOutboundView.tsx   → View cho nhân viên: đơn chờ + lịch sử xuất
 *   - types.ts                → Shared types
 */
export { default as StockDisplay } from './StockDisplay';
export { default as FulfillOrderDialog } from './FulfillOrderDialog';
export { default as StaffOutboundView } from './StaffOutboundView';
export { sendTelegramNotification } from './outboundTelegram';
export type { OutboundTransaction, OutboundFormState } from './types';
