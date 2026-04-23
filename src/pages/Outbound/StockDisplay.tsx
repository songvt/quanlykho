import { Chip } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { selectProductStock } from '../../store/slices/inventorySlice';

interface StockDisplayProps {
    productId: string;
}

/**
 * Hiển thị tồn kho hiện tại của một sản phẩm dưới dạng Chip
 */
const StockDisplay = ({ productId }: StockDisplayProps) => {
    const totalStock = useSelector((state: RootState) => selectProductStock(state, productId));
    return (
        <Chip
            label={`Tồn: ${totalStock}`}
            size="small"
            color={totalStock > 0 ? 'success' : 'error'}
            variant="outlined"
            sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
        />
    );
};

export default StockDisplay;
