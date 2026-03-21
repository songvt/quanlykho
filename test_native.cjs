const ExcelJS = require('exceljs');

async function test() {
    const sheetConfig = () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bien_Ban_Ban_Giao');

        sheet.mergeCells('A1:D1');
        sheet.mergeCells('A2:D2');
        sheet.mergeCells('G1:H1');
        sheet.mergeCells('G2:H2');
        sheet.mergeCells('G3:H3');
        sheet.mergeCells('G4:H4');
        sheet.mergeCells('G5:H5');
        
        // Title
        sheet.mergeCells('A6:H6');
        // Date
        sheet.mergeCells('A7:H7');
        // Report
        sheet.mergeCells('A8:H8');

        // Spacer
        sheet.addRow([]);

        let currentRow = 11;
        const addInfoRow = (label1, val1, label2, val2) => {
            sheet.mergeCells(`A${currentRow}:B${currentRow}`);
            sheet.mergeCells(`C${currentRow}:D${currentRow}`);
            if (label2) {
                sheet.mergeCells(`E${currentRow}:F${currentRow}`);
                sheet.mergeCells(`G${currentRow}:H${currentRow}`);
            }
            currentRow++;
        };

        currentRow++; // BÊN GIAO label
        addInfoRow("Họ tên", "A");
        addInfoRow("Chức vụ", "B", "ĐT", "C");
        sheet.mergeCells(`A${currentRow}:H${currentRow}`); currentRow++;
        sheet.mergeCells(`A${currentRow}:H${currentRow}`); currentRow++;
        currentRow++; // Spacer

        currentRow++; // BÊN NHẬN
        sheet.mergeCells(`A${currentRow}:H${currentRow}`); currentRow++;
        addInfoRow("Họ tên", "A");
        addInfoRow("Chức vụ", "B", "ĐT", "C");
        currentRow++;

        currentRow++; // Table Header

        // Data 
        sheet.getRow(currentRow).getCell(1).value = 1;
        currentRow++;

        const totalRow = sheet.addRow(['TỔNG CỘNG', '', '', '', 1, '', 100, '']);
        sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);

        const textRow = sheet.addRow([`Tổng số tiền (viết bằng chữ)`]);
        sheet.mergeCells(`A${textRow.number}:H${textRow.number}`);

        const noteRow = sheet.addRow(['Lưu ý : Kiểm tra trước khi đi']);
        sheet.mergeCells(`A${noteRow.number}:H${noteRow.number}`);

        sheet.addRow([]);

        const sigHeader = sheet.addRow(['Người nhận', '', '', 'Thủ kho', '', 'Thủ trưởng đơn vị', '', '']);
        sheet.mergeCells(`A${sigHeader.number}:C${sigHeader.number}`);
        sheet.mergeCells(`D${sigHeader.number}:E${sigHeader.number}`);
        sheet.mergeCells(`F${sigHeader.number}:H${sigHeader.number}`);

        const sigTitle = sheet.addRow(['(Ký, họ tên)', '', '', '(Ký, họ tên)', '', '(Ký, họ tên)', '', '']);
        sheet.mergeCells(`A${sigTitle.number}:C${sigTitle.number}`);
        sheet.mergeCells(`D${sigTitle.number}:E${sigTitle.number}`);
        sheet.mergeCells(`F${sigTitle.number}:H${sigTitle.number}`);

        sheet.addRow([]); sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);

        const sigName = sheet.addRow(['A', '', '', 'B', '', 'C', '', '']);
        sheet.mergeCells(`A${sigName.number}:C${sigName.number}`);
        sheet.mergeCells(`D${sigName.number}:E${sigName.number}`);
        sheet.mergeCells(`F${sigName.number}:H${sigName.number}`);
        
        return workbook;
    };

    try {
        const wb = sheetConfig();
        await wb.xlsx.writeBuffer();
        console.log("SUCCESS");
    } catch (e) {
        console.log("ERROR:", e.message);
    }
}
test();
