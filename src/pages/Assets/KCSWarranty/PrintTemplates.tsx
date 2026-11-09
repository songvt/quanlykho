import React from 'react';
import dayjs from 'dayjs';

interface PrintTemplatesProps {
    data: any;
}

export const PrintTemplates: React.FC<PrintTemplatesProps> = ({ data }) => {
    if (!data) return null;

    const {
        form_type,
        form_code,
        created_at,
        department,
        reason,
        equipment_list = [],
        kcs_conclusion,
        handover_representative,
        receiver_representative,
        requester_name
    } = data;

    const request_date = created_at;

    // ─────────────────────────────────────────────────────────────
    // 1. BIỂU MẪU 1: PHIẾU YÊU CẦU KIỂM TRA CHẤT LƯỢNG (KCS)
    // ─────────────────────────────────────────────────────────────
    if (form_type === 'YEU_CAU_KCS') {
        const formattedDate = created_at && dayjs(created_at).isValid()
            ? `TP. Hồ Chí Minh, ngày ${dayjs(created_at).format('DD')} tháng ${dayjs(created_at).format('MM')} năm ${dayjs(created_at).format('YYYY')}`
            : 'TP. Hồ Chí Minh, ngày ..... tháng ..... năm 20...';

        return (
            <div style={{ width: '100%', color: '#000000', fontFamily: '"Times New Roman", Times, serif', fontSize: '11.5pt', lineHeight: 1.35 }}>
                {/* Header 2 cột: Đơn vị (trái) và Quốc hiệu (phải) */}
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ textAlign: 'center', width: '42%' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.25 }}>
                            KHỐI DỊCH VỤ KỸ THUẬT
                        </div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.25 }}>
                            TRUNG TÂM BẮC SÀI GÒN
                        </div>
                        <div style={{ width: '45%', margin: '2px auto 3px', borderBottom: '1.5px solid black' }} />
                        <div style={{ fontSize: '10.5pt', lineHeight: 1.2 }}>
                            Số: {form_code}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', width: '56%' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </div>
                        <div style={{ fontSize: '11.5pt', fontWeight: 'bold', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
                            Độc lập - Tự do - Hạnh phúc
                        </div>
                        <div style={{ width: '140px', margin: '2px auto 3px', borderBottom: '1.5px solid black' }} />
                        <div style={{ fontSize: '10.5pt', fontStyle: 'italic', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                            {formattedDate}
                        </div>
                    </div>
                </div>

                {/* Tiêu đề biểu mẫu */}
                <div style={{ textAlign: 'center', marginTop: '6px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        PHIẾU YÊU CẦU KIỂM TRA CHẤT LƯỢNG (KCS)
                    </div>
                </div>

                {/* I. THÔNG TIN CHUNG */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '4px' }}>
                        I. Thông tin chung
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', lineHeight: 1.4, paddingLeft: '6px' }}>
                        <div style={{ width: '58%' }}>
                            <div>• <b>Bộ phận yêu cầu:</b> {department || 'Trung Tâm Bắc Sài Gòn'}</div>
                            <div>• <b>Mã phiếu:</b> {form_code}</div>
                            <div>• <b>Lý do yêu cầu:</b> {reason || 'Thiết bị hư hỏng cần kiểm tra bảo hành , trả kho'}</div>
                        </div>
                        <div style={{ width: '40%' }}>
                            <div>• <b>Người yêu cầu:</b> {requester_name || ''}</div>
                            <div>• <b>Ngày yêu cầu:</b> {dayjs(created_at).format('DD/MM/YYYY')}</div>
                        </div>
                    </div>
                </div>

                {/* II. THÔNG TIN THIẾT BỊ CẦN KIỂM TRA */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '5px' }}>
                        II. Thông tin thiết bị cần kiểm tra
                    </div>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontFamily: '"Times New Roman", Times, serif',
                        fontSize: '10.5pt'
                    }}>
                        <thead>
                            <tr style={{ backgroundColor: '#ffffff' }}>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '5%', textAlign: 'center', fontWeight: 'bold' }}>STT</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 6px', width: '32%', textAlign: 'center', fontWeight: 'bold' }}>Tên thiết bị</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '10%', textAlign: 'center', fontWeight: 'bold' }}>Model</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 5px', width: '18%', textAlign: 'center', fontWeight: 'bold' }}>Serial</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '9%', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Số lượng</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 6px', width: '26%', textAlign: 'center', fontWeight: 'bold' }}>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipment_list && equipment_list.length > 0 ? (
                                equipment_list.map((row: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ border: '1px solid black', padding: '3px 6px', lineHeight: 1.25 }}>{row.product_name}</td>
                                        <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>{row.model || ''}</td>
                                        <td style={{ border: '1px solid black', padding: '3px 5px', textAlign: 'center' }}>{row.serial || ''}</td>
                                        <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>
                                            {Number(row.quantity) < 10 && Number(row.quantity) > 0 ? `0${row.quantity}` : (row.quantity || '01')}
                                        </td>
                                        <td style={{ border: '1px solid black', padding: '3px 6px', lineHeight: 1.25 }}>{row.issue_notes || ''}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        Chưa có thiết bị nào trong danh sách
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* III. NỘI DUNG YÊU CẦU KIỂM TRA */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '3px' }}>
                        III. Nội dung yêu cầu kiểm tra
                    </div>
                    <div style={{ paddingLeft: '10px', fontSize: '10.5pt', lineHeight: 1.35 }}>
                        <div>• Kiểm tra hình thức bên ngoài.</div>
                        <div>• Kiểm tra hoạt động chức năng chính.</div>
                        <div>• Đề xuất hướng xử lý nếu có vấn đề.</div>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '10.5pt' }}>
                        <b>Ghi chú thêm:</b> .........................................................................................................................................
                    </div>
                </div>

                {/* IV. KHỐI CHỮ KÝ */}
                <div className="page-break-avoid" style={{ marginTop: '14px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Người yêu cầu
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '52px' }} />
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                {requester_name || ''}
                            </div>
                        </div>

                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Trưởng bộ phận yêu cầu
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '68px' }} />
                        </div>

                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Bộ phận KCS
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '68px' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 2. BIỂU MẪU 2: BIÊN BẢN KIỂM TRA ĐÁNH GIÁ CHẤT LƯỢNG
    // ─────────────────────────────────────────────────────────────
    if (form_type === 'KIEM_TRA_KCS') {
        const formattedDate = request_date && dayjs(request_date).isValid()
            ? `TP. Hồ Chí Minh, ngày ${dayjs(request_date).format('DD')} tháng ${dayjs(request_date).format('MM')} năm ${dayjs(request_date).format('YYYY')}`
            : 'TP. Hồ Chí Minh, ngày ..... tháng ..... năm 20...';

        return (
            <div style={{ width: '100%', color: '#000000', fontFamily: '"Times New Roman", Times, serif', fontSize: '11.5pt', lineHeight: 1.35 }}>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center', width: '48%' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            CÔNG TY CỔ PHẦN VIỄN THÔNG ACT
                        </div>
                        <div style={{ fontSize: '11.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            KHỐI DỊCH VỤ KỸ THUẬT
                        </div>
                        <div style={{ width: '45%', margin: '3px auto 4px', borderBottom: '1.5px solid black' }} />
                    </div>

                    <div style={{ textAlign: 'center', width: '50%' }}>
                        <div style={{ fontSize: '11.5pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </div>
                        <div style={{ fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            Độc lập - Tự do - Hạnh phúc
                        </div>
                        <div style={{ width: '150px', margin: '3px auto 4px', borderBottom: '1.5px solid black' }} />
                        <div style={{ fontSize: '11pt', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                            {formattedDate}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '14.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        BIÊN BẢN KIỂM TRA ĐÁNH GIÁ CHẤT LƯỢNG
                    </div>
                </div>

                {/* I. THÔNG TIN CHUNG */}
                <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '3px' }}>
                        I. Thông tin chung
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Times New Roman", Times, serif', fontSize: '10.5pt' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid black', padding: '3.5px 6px', width: '50%' }}><b>Số biên bản:</b> {form_code}</td>
                                <td style={{ border: '1px solid black', padding: '3.5px 6px', width: '50%' }}>BB-KCS{form_code?.match(/\d+$/)?.[0] || ''}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{ border: '1px solid black', padding: '3.5px 6px' }}><b>Ngày kiểm tra:</b> {dayjs(request_date).format('DD/MM/YYYY')}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{ border: '1px solid black', padding: '3.5px 6px' }}><b>Địa điểm:</b> TT Bắc Sài Gòn</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{ border: '1px solid black', padding: '3.5px 6px' }}><b>Người kiểm tra (Ban KCS):</b> ........................................................................................</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{ border: '1px solid black', padding: '3.5px 6px' }}><b>Đại diện bộ phận sử dụng:</b> ........................................................................................</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. THÔNG TIN THIẾT BỊ */}
                <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '4px' }}>
                        II. Thông tin thiết bị
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Times New Roman", Times, serif', fontSize: '10.5pt' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#ffffff' }}>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '6%', textAlign: 'center', fontWeight: 'bold' }}>STT</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 6px', width: '32%', textAlign: 'center', fontWeight: 'bold' }}>Tên thiết bị</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 5px', width: '15%', textAlign: 'center', fontWeight: 'bold' }}>Mã thiết bị</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 5px', width: '19%', textAlign: 'center', fontWeight: 'bold' }}>Model/Serial</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 5px', width: '18%', textAlign: 'center', fontWeight: 'bold' }}>Nhà cung cấp</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '10%', textAlign: 'center', fontWeight: 'bold' }}>Số lượng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipment_list && equipment_list.map((row: any, idx: number) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 6px', lineHeight: 1.25 }}>{row.product_name}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 5px', textAlign: 'center' }}>{row.item_code}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 5px', textAlign: 'center' }}>{row.serial}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 5px' }}>{row.supplier}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>
                                        {row.quantity < 10 ? `0${row.quantity}` : row.quantity}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* III. NỘI DUNG KIỂM TRA */}
                <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '4px' }}>
                        III. Nội dung kiểm tra
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Times New Roman", Times, serif', fontSize: '10.5pt' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#ffffff' }}>
                                <th style={{ border: '1px solid black', padding: '3.5px 4px', width: '6%', textAlign: 'center', fontWeight: 'bold' }}>STT</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 6px', width: '44%', textAlign: 'center', fontWeight: 'bold' }}>Hạng mục kiểm tra</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 5px', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>Đạt / Không đạt</th>
                                <th style={{ border: '1px solid black', padding: '3.5px 6px', width: '25%', textAlign: 'center', fontWeight: 'bold' }}>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipment_list && equipment_list.map((row: any, idx: number) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 6px', lineHeight: 1.25 }}>{row.product_name}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 5px', textAlign: 'center' }}>{row.status}</td>
                                    <td style={{ border: '1px solid black', padding: '3px 6px', lineHeight: 1.25 }}>{row.issue_notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* IV. KẾT LUẬN */}
                <div style={{ marginBottom: '8px', fontSize: '11pt', lineHeight: 1.35 }}>
                    <div style={{ fontSize: '11.5pt', fontWeight: 'bold', marginBottom: '3px' }}>
                        IV. Kết luận
                    </div>
                    <div>[ {kcs_conclusion === 'DAT' ? 'X' : '  '} ] Thiết bị đạt yêu cầu và được đưa vào sử dụng</div>
                    <div>[ {kcs_conclusion === 'KHONG_DAT' ? 'X' : '  '} ] Thiết bị không đạt yêu cầu, đề xuất: trả kho</div>
                    <div>[ {kcs_conclusion === 'TRA_NCC' ? 'X' : '  '} ] Trả lại nhà cung cấp</div>
                    <div>[ {kcs_conclusion === 'BAO_HANH' ? 'X' : '  '} ] Sửa chữa/bảo hành</div>
                    <div>[ {kcs_conclusion === 'THANH_LY' ? 'X' : '  '} ] Thanh lý/loại bỏ</div>
                </div>

                {/* V. CHỮ KÝ */}
                <div className="page-break-avoid" style={{ marginTop: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Người kiểm tra (KCS)
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '65px' }} />
                        </div>
                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Ban KCS
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '65px' }} />
                        </div>
                        <div style={{ width: '32%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                Đại diện bộ phận sử dụng
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '65px' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. BIỂU MẪU 3: BIÊN BẢN BÀN GIAO THIẾT BỊ TRƯỚC BẢO HÀNH SỬA CHỮA
    // ─────────────────────────────────────────────────────────────
    if (form_type === 'BAN_GIAO_BH') {
        const docSubNum = form_code?.match(/\d+$/)?.[0] || '...........';
        const docYear = dayjs(created_at).format('YYYY');

        return (
            <div style={{ width: '100%', color: '#000000', fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', lineHeight: 1.35 }}>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center', width: '48%' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            CÔNG TY CỔ PHẦN VIỄN THÔNG ACT
                        </div>
                        <div style={{ fontSize: '11.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            TRUNG TÂM ACT BẮC SÀI GÒN
                        </div>
                        <div style={{ width: '45%', margin: '3px auto 4px', borderBottom: '1.5px solid black' }} />
                    </div>

                    <div style={{ textAlign: 'center', width: '50%' }}>
                        <div style={{ fontSize: '11.5pt', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </div>
                        <div style={{ fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            Độc lập - Tự do - Hạnh phúc
                        </div>
                        <div style={{ width: '150px', margin: '3px auto 4px', borderBottom: '1.5px solid black' }} />
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        BIÊN BẢN BÀN GIAO THIẾT BỊ TRƯỚC BẢO HÀNH SỬA CHỮA
                    </div>
                    <div style={{ fontSize: '11pt', marginTop: '2px' }}>
                        (Số: {docSubNum}/{docYear}/BBBG-PQLTS)
                    </div>
                </div>

                <div style={{ marginBottom: '10px', fontSize: '11pt', lineHeight: 1.4 }}>
                    <div>
                        Hôm nay, ngày {dayjs(created_at).format('DD')} tháng {dayjs(created_at).format('MM')} năm {dayjs(created_at).format('YYYY')}, Tại: Công ty CP Viễn thông ACT.
                    </div>
                    <div>
                        Chúng tôi gồm:
                    </div>
                    <div style={{ paddingLeft: '14px', marginTop: '2px' }}>
                        <div><b>Đại diện bên giao:</b> 1. Đ/c: {handover_representative || '................................'} - Chức vụ: ........................</div>
                        <div><b>Đại diện bên nhận:</b> 1. Đ/c: {receiver_representative || '................................'} - Chức vụ: ........................</div>
                    </div>
                    <div style={{ marginTop: '2px' }}>
                        <b>Lý do:</b> {reason || 'Bàn giao thiết bị trước bảo hành sửa chữa'}
                    </div>
                    <div style={{ marginTop: '2px' }}>
                        Hai bên cùng thống nhất lập biên bản, bàn giao số lượng và chất lượng tài sản như sau:
                    </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Times New Roman", Times, serif', fontSize: '10pt' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#ffffff' }}>
                                <th style={{ border: '1px solid black', padding: '4px 2px', width: '4%', textAlign: 'center', fontWeight: 'bold' }}>STT</th>
                                <th style={{ border: '1px solid black', padding: '4px 4px', width: '16%', textAlign: 'center', fontWeight: 'bold' }}>Tên tài sản</th>
                                <th style={{ border: '1px solid black', padding: '4px 3px', width: '11%', textAlign: 'center', fontWeight: 'bold' }}>Mã tài sản</th>
                                <th style={{ border: '1px solid black', padding: '4px 3px', width: '10%', textAlign: 'center', fontWeight: 'bold' }}>Hãng SX</th>
                                <th style={{ border: '1px solid black', padding: '4px 3px', width: '14%', textAlign: 'center', fontWeight: 'bold' }}>Số Serial</th>
                                <th style={{ border: '1px solid black', padding: '4px 2px', width: '6%', textAlign: 'center', fontWeight: 'bold' }}>SL</th>
                                <th style={{ border: '1px solid black', padding: '4px 3px', width: '10%', textAlign: 'center', fontWeight: 'bold' }}>Ngày hỏng</th>
                                <th style={{ border: '1px solid black', padding: '4px 3px', width: '15%', textAlign: 'center', fontWeight: 'bold' }}>Hạn bảo hành</th>
                                <th style={{ border: '1px solid black', padding: '4px 4px', width: '14%', textAlign: 'center', fontWeight: 'bold' }}>Tình trạng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipment_list && equipment_list.map((row: any, idx: number) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid black', padding: '4px 2px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 4px' }}>{row.product_name}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 3px', textAlign: 'center' }}>{row.item_code}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 3px', textAlign: 'center' }}>{row.manufacturer}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 3px', textAlign: 'center' }}>{row.serial}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 2px', textAlign: 'center' }}>
                                        {row.quantity < 10 ? `0${row.quantity}` : row.quantity}
                                    </td>
                                    <td style={{ border: '1px solid black', padding: '4px 3px', textAlign: 'center' }}>{row.broken_date}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 3px', textAlign: 'center' }}>{row.warranty_end}</td>
                                    <td style={{ border: '1px solid black', padding: '4px 4px' }}>{row.issue_notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', fontStyle: 'italic', marginBottom: '10px' }}>
                    Biên bản này được làm thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau và có hiệu lực kể từ ngày ký.
                </div>

                {/* Khối chữ ký 4 bên */}
                <div className="page-break-avoid" style={{ marginTop: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div style={{ width: '24%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                ĐẠI DIỆN BÊN NHẬN
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '3px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '80px' }} />
                        </div>
                        <div style={{ width: '24%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                NGƯỜI NHẬN
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '3px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '80px' }} />
                        </div>
                        <div style={{ width: '24%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                ĐẠI DIỆN BÊN GIAO
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '3px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '80px' }} />
                        </div>
                        <div style={{ width: '24%' }}>
                            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                                NGƯỜI GIAO
                            </div>
                            <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '3px' }}>
                                (Ký, ghi rõ họ tên)
                            </div>
                            <div style={{ height: '80px' }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '6px', borderTop: '0.5px solid #ccc' }}>
                    <div style={{ fontSize: '10pt', fontStyle: 'italic' }}>
                        BM.03/QT.QLTS.03
                    </div>
                    <div style={{ fontSize: '10pt', fontStyle: 'italic' }}>
                        Lần ban hành: 01 / Ngày ban hành .../.../....
                    </div>
                    <div style={{ fontSize: '10pt', fontStyle: 'italic' }}>
                        1/1
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
