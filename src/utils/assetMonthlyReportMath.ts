export const calculateInspectionQuantity = (bookQuantity: number, increaseQuantity: number, decreaseQuantity: number) =>
    bookQuantity + increaseQuantity - decreaseQuantity;

export const calculateQuantityDifference = (bookQuantity: number, inspectionQuantity: number) =>
    bookQuantity - inspectionQuantity;

// The monthly TBVP report records the operational condition currently used by
// the warehouse, rather than generic good/lost labels.
export const assetMonthlyStatusColumns = [
    'Số lượng đang sử dụng',
    'Số lượng hỏng',
    'Số lượng chưa sử dụng',
    'Sửa chữa/bảo dưỡng',
] as const;

export const getPreviousReportMonth = (month: number, year: number) => {
    const previous = new Date(year, month - 2, 1);
    const previousMonth = previous.getMonth() + 1;
    return {
        month: previousMonth,
        year: previous.getFullYear(),
        label: String(previousMonth).padStart(2, '0'),
    };
};
