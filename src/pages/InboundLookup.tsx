import React, { useState } from 'react';
import { Box, Typography, TextField, CircularProgress, Card, CardContent, Divider, Grid, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import PageHeader from '../components/Common/PageHeader';
import { Search, Package, Calendar, MapPin, Hash, User, QrCode } from 'lucide-react';
import { supabase } from '../config/supabase';
import QRScanner from '../components/QRScanner';

export default function InboundLookup() {
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [searched, setSearched] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setSearched(true);
        try {
            const queryText = searchQuery.trim();
            // Search inbound transactions by serial_code exactly or partially
            const { data, error } = await supabase
                .from('inbound_transactions')
                .select(`
                    *,
                    product:products(name, item_code, unit)
                `)
                .ilike('serial_code', `%${queryText}%`)
                .order('inbound_date', { ascending: false });

            if (error) {
                console.error("Lỗi khi tìm kiếm:", error);
            } else {
                setResults(data || []);
            }
        } catch (error) {
            console.error("Lỗi ngoại lệ:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto', width: '100%', overflowX: 'hidden' }}>
            <PageHeader
                title="TRA CỨU HÀNG HÓA"
                subtitle="Quét hoặc nhập số Serial để tra cứu thông tin hàng hóa đã nhập"
                icon={<Search size={28} color="white" />}
                gradientType="blue"
            />

            <Paper sx={{ p: 3, mb: 3, borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <form onSubmit={handleSearch}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Quét hoặc nhập số Serial..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                            InputProps={{
                                startAdornment: <Search size={20} color="#94A3B8" style={{ marginRight: 8 }} />,
                                endAdornment: (
                                    <IconButton onClick={() => setShowScanner(true)} sx={{ color: '#60A5FA' }}>
                                        <QrCode size={20} />
                                    </IconButton>
                                )
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                    '&:hover fieldset': { borderColor: '#60A5FA' },
                                    '&.Mui-focused fieldset': { borderColor: '#60A5FA' },
                                }
                            }}
                        />
                        <Box
                            component="button"
                            type="submit"
                            disabled={loading || !searchQuery.trim()}
                            sx={{
                                width: { xs: '100%', sm: 'auto' },
                                height: 56,
                                px: { xs: 2, sm: 4 },
                                borderRadius: '12px',
                                bgcolor: '#3B82F6',
                                color: 'white',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { bgcolor: '#2563EB' },
                                '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed' }
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Tra Cứu'}
                        </Box>
                    </Box>
                </form>
            </Paper>

            {searched && !loading && results.length === 0 && (
                <Box textAlign="center" p={5} sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Package size={48} color="#64748B" style={{ opacity: 0.5, marginBottom: 16 }} />
                    <Typography color="#94A3B8" fontSize="1.1rem">
                        Không tìm thấy hàng hóa nào với Serial: <b>{searchQuery}</b>
                    </Typography>
                </Box>
            )}

            {results.length > 0 && (
                <Grid container spacing={3}>
                    {results.map((item) => (
                        <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                            <Card sx={{ 
                                bgcolor: 'rgba(255, 255, 255, 0.03)', 
                                border: '1px solid rgba(255, 255, 255, 0.1)', 
                                borderRadius: '16px',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: 'rgba(96, 165, 250, 0.5)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                }
                            }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                                        <Box sx={{ 
                                            p: 1.5, 
                                            borderRadius: '12px', 
                                            bgcolor: 'rgba(59, 130, 246, 0.1)', 
                                            color: '#60A5FA',
                                            mr: 2
                                        }}>
                                            <Package size={24} />
                                        </Box>
                                        <Box flex={1}>
                                            <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 600, fontSize: '1.1rem', mb: 0.5 }}>
                                                {item.product?.name || 'Sản phẩm không xác định'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Hash size={14} /> {item.product?.item_code || 'N/A'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    
                                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />
                                    
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>Serial Number</Typography>
                                            <Typography sx={{ color: '#E2E8F0', fontWeight: 500, wordBreak: 'break-all' }}>
                                                {item.serial_code || 'Không có'}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>Khu vực / Quận</Typography>
                                            <Typography sx={{ color: '#E2E8F0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <MapPin size={14} color="#60A5FA" /> {item.district || 'Kho Tổng'}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>Trạng thái</Typography>
                                            <Box component="span" sx={{ 
                                                px: 1.5, py: 0.5, 
                                                borderRadius: '20px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 600,
                                                bgcolor: item.item_status === 'Mới' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                color: item.item_status === 'Mới' ? '#34D399' : '#FBBF24',
                                                border: '1px solid',
                                                borderColor: item.item_status === 'Mới' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                                            }}>
                                                {item.item_status || 'Mới'}
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>Ngày nhập</Typography>
                                            <Typography sx={{ color: '#E2E8F0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Calendar size={14} color="#60A5FA" /> 
                                                {item.inbound_date ? new Date(item.inbound_date).toLocaleDateString('vi-VN') : 'N/A'}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Typography sx={{ color: '#64748B', fontSize: '0.8rem', mb: 0.5 }}>Người nhập</Typography>
                                            <Typography sx={{ color: '#E2E8F0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <User size={14} color="#60A5FA" /> {item.created_by || 'Hệ thống'}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Dialog
                open={showScanner}
                onClose={() => setShowScanner(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: '#1E293B',
                        color: 'white',
                        borderRadius: '16px'
                    }
                }}
            >
                <DialogTitle>Quét mã Serial</DialogTitle>
                <DialogContent>
                    {showScanner && (
                        <QRScanner
                            onScanSuccess={async (decodedText) => {
                                setSearchQuery(decodedText);
                                setShowScanner(false);
                            }}
                            onScanFailure={() => {}}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowScanner(false)} sx={{ color: '#94A3B8' }}>Đóng</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
