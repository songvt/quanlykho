import { Box, Chip, Typography, Stack } from '@mui/material';
import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface SerialChipsProps {
    serials: string[];
    onRemove: (serial: string) => void;
    maxVisible?: number;
}

/**
 * SerialChips
 * Component hiển thị danh sách serial đã quét một cách tối ưu.
 * Chỉ hiển thị N item gần nhất, hỗ trợ mở rộng để xem tất cả.
 * Giúp UI không bị lag khi số lượng serial lên đến hàng trăm.
 */
const SerialChips = ({ serials, onRemove, maxVisible = 20 }: SerialChipsProps) => {
    const [expanded, setExpanded] = useState(false);

    if (serials.length === 0) return null;

    const visibleSerials = expanded ? serials : serials.slice(-maxVisible).reverse();
    const hiddenCount = serials.length - maxVisible;

    return (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f1f5f9', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" fontWeight="700" color="text.secondary">
                    ĐÃ QUÉT: {serials.length} SERIAL
                </Typography>
                {serials.length > maxVisible && (
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            cursor: 'pointer', 
                            color: 'primary.main', 
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? 'Thu gọn' : `Xem thêm ${hiddenCount} serial cũ`}
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </Typography>
                )}
            </Stack>

            <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1, 
                maxHeight: expanded ? '400px' : 'none', 
                overflowY: expanded ? 'auto' : 'visible'
            }}>
                {visibleSerials.map((serial) => (
                    <Chip
                        key={serial}
                        label={serial}
                        onDelete={() => onRemove(serial)}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ 
                            bgcolor: 'white', 
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            '& .MuiChip-label': { px: 1 }
                        }}
                    />
                ))}
                {!expanded && serials.length > maxVisible && (
                    <Chip 
                        label={`+${hiddenCount}...`} 
                        size="small"
                        variant="outlined"
                        sx={{ bgcolor: 'white', fontStyle: 'italic', color: 'text.disabled' }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default SerialChips;
