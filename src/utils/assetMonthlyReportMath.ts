export const calculateInspectionQuantity = (bookQuantity: number, increaseQuantity: number, decreaseQuantity: number) =>
    bookQuantity + increaseQuantity - decreaseQuantity;

export const calculateQuantityDifference = (bookQuantity: number, inspectionQuantity: number) =>
    bookQuantity - inspectionQuantity;
