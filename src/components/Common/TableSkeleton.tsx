import { TableRow, TableCell, Skeleton } from '@mui/material';

interface TableSkeletonProps {
    columns: number;
    rows?: number;
}

const TableSkeleton = ({ columns, rows = 5 }: TableSkeletonProps) => {
    return (
        <>
            {Array.from(new Array(rows)).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                    {Array.from(new Array(columns)).map((_, colIndex) => (
                        <TableCell key={colIndex}>
                            <Skeleton variant="text" animation="wave" width={colIndex === 0 ? 40 : '80%'} />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
};

export default TableSkeleton;
