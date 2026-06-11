import React, { useRef, useEffect } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Divider, IconButton, Tooltip, Select, MenuItem } from '@mui/material';
import { 
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Image, Table, Trash2, Undo, Redo, RefreshCw, Palette
} from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
    value, 
    onChange, 
    placeholder = 'Nhập nội dung...', 
    minHeight = '300px' 
}) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Run basic commands
    const execCmd = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    // Prevent cursor jumping when rendering value updates from parent
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const insertTable = () => {
        const rows = prompt('Nhập số hàng:', '3');
        const cols = prompt('Nhập số cột:', '3');
        if (!rows || !cols) return;

        let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 12px 0;"><tbody>';
        for (let i = 0; i < parseInt(rows); i++) {
            tableHtml += '<tr>';
            for (let j = 0; j < parseInt(cols); j++) {
                tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; min-width: 50px;">${i === 0 ? '<b>Tiêu đề</b>' : 'Ô dữ liệu'}</td>`;
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table><p>&nbsp;</p>';
        execCmd('insertHTML', tableHtml);
    };

    const insertImage = () => {
        const url = prompt('Nhập URL hình ảnh:');
        if (url) {
            execCmd('insertHTML', `<img src="${url}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />`);
        }
    };

    return (
        <Box sx={{ 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            bgcolor: 'var(--bg-card)', 
            overflow: 'hidden',
            transition: 'border-color 0.2s',
            '&:focus-within': {
                borderColor: 'var(--brand-primary)',
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)'
            }
        }}>
            {/* Editor Toolbar */}
            <Box sx={{ 
                p: 1, 
                bgcolor: 'var(--bg-default)', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.5
            }}>
                <Tooltip title="Hoàn tác">
                    <IconButton size="small" onClick={() => execCmd('undo')}><Undo size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Làm lại">
                    <IconButton size="small" onClick={() => execCmd('redo')}><Redo size={16} /></IconButton>
                </Tooltip>
                
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

                <Tooltip title="Chữ đậm">
                    <IconButton size="small" onClick={() => execCmd('bold')}><Bold size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Chữ nghiêng">
                    <IconButton size="small" onClick={() => execCmd('italic')}><Italic size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Gạch chân">
                    <IconButton size="small" onClick={() => execCmd('underline')}><Underline size={16} /></IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

                <Tooltip title="Căn lề trái">
                    <IconButton size="small" onClick={() => execCmd('justifyLeft')}><AlignLeft size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Căn giữa">
                    <IconButton size="small" onClick={() => execCmd('justifyCenter')}><AlignCenter size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Căn lề phải">
                    <IconButton size="small" onClick={() => execCmd('justifyRight')}><AlignRight size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Căn đều">
                    <IconButton size="small" onClick={() => execCmd('justifyFull')}><AlignJustify size={16} /></IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

                <Tooltip title="Danh sách không thứ tự">
                    <IconButton size="small" onClick={() => execCmd('insertUnorderedList')}><List size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Danh sách có thứ tự">
                    <IconButton size="small" onClick={() => execCmd('insertOrderedList')}><ListOrdered size={16} /></IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

                <Tooltip title="Chèn bảng">
                    <IconButton size="small" onClick={insertTable}><Table size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Chèn ảnh">
                    <IconButton size="small" onClick={insertImage}><Image size={16} /></IconButton>
                </Tooltip>
                
                <Tooltip title="Chọn màu chữ">
                    <IconButton size="small" onClick={() => {
                        const color = prompt('Nhập mã màu HEX hoặc tên tiếng Anh (ví dụ: red, #2563eb):', '#2563eb');
                        if (color) execCmd('foreColor', color);
                    }}><Palette size={16} /></IconButton>
                </Tooltip>

                <Tooltip title="Xóa định dạng">
                    <IconButton size="small" onClick={() => execCmd('removeFormat')}><Trash2 size={16} /></IconButton>
                </Tooltip>
            </Box>

            {/* Editable Area */}
            <Box 
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                data-placeholder={placeholder}
                sx={{
                    p: 2.5,
                    minHeight,
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    overflowY: 'auto',
                    '&:empty:before': {
                        content: 'attr(data-placeholder)',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        opacity: 0.7
                    },
                    '& table': {
                        width: '100%',
                        borderCollapse: 'collapse',
                        margin: '12px 0',
                    },
                    '& td, & th': {
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        fontSize: '0.9rem'
                    },
                    '& ul, & ol': {
                        paddingLeft: '24px',
                        margin: '10px 0'
                    }
                }}
            />
        </Box>
    );
};

export default RichTextEditor;
