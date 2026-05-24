import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, List, ListItem, ListItemText, Chip, Grid, IconButton, Tooltip, Avatar,
    Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Divider,
    Popover, ListItemButton
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Inventory2Outlined as InventoryIcon,
    WarningAmberOutlined as WarningIcon,
    ErrorOutline as ErrorIcon,
    LocalShippingOutlined as ShippingIcon,
    RefreshOutlined as RefreshIcon,
    AutoAwesomeOutlined as AIIcon,
    CopyrightOutlined as CopyrightIcon,
    StarBorder as StarBorderIcon,
    Star as StarIcon,
    Close as CloseIcon,
    SupportAgent as SupportAgentIcon,
    InfoOutlined as InfoIcon,
    DevicesOther as DevicesIcon,
    FactCheckOutlined as FactCheckIcon,
    AssessmentOutlined as AssessmentIcon,
    KeyboardReturnOutlined as InputIcon,
    QrCode2 as QrCodeIcon,
    ShoppingCartOutlined as OrderIcon,
    AssignmentReturnOutlined as ReturnIcon,
    HistoryOutlined as HistoryIcon,
    PeopleOutline as PeopleIcon,
    SettingsOutlined as SettingsIcon,
    ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import {
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import type { RootState, AppDispatch } from '../store';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchTransactions } from '../store/slices/transactionsSlice';
import { fetchInventory, selectStockMap } from '../store/slices/inventorySlice';
import { fetchOrders } from '../store/slices/ordersSlice';
import { fetchEmployees } from '../store/slices/employeesSlice';

import DashboardSkeleton from './DashboardSkeleton';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { formatDate, parseDate } from '../utils/dateUtils';
import { formatNumber } from '../utils/numberUtils';

// Premium HSL semantic color palette
const COLORS = {
    primary: '#4f46e5',   // Aurora Indigo
    success: '#10b981',   // Emerald Mint
    warning: '#f59e0b',   // Vibrant Amber
    error: '#f43f5e',     // Rose Crimson
    slate: '#64748b'
};

const MetricCard = ({ title, value, subtitle, icon, color, trend, onClick }: any) => {
    const bgLight = alpha(color, 0.05);
    const borderLight = alpha(color, 0.12);

    return (
        <Paper 
            elevation={0} 
            onClick={onClick}
            sx={{ 
                p: { xs: 3, sm: 3.5 }, 
                borderRadius: '24px', 
                border: `1px solid ${borderLight}`,
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '4px',
                    bgcolor: color,
                    opacity: 0.85,
                },
                '&:hover': onClick ? {
                    transform: 'translateY(-6px)',
                    boxShadow: `0 20px 30px -10px ${alpha(color, 0.16)}`,
                    borderColor: color,
                    '& .icon-box': {
                        transform: 'scale(1.1) rotate(5deg)',
                        bgcolor: alpha(color, 0.18),
                        boxShadow: `0 8px 20px -4px ${alpha(color, 0.3)}`
                    }
                } : {}
            }}
        >
            <Box display="flex" alignItems="center" gap={2} mb={2.5}>
                {icon && (
                    <Box className="icon-box" sx={{ 
                        color: color, 
                        display: 'flex', 
                        p: 1.5, 
                        bgcolor: bgLight, 
                        borderRadius: '16px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: `1px solid ${alpha(color, 0.08)}`
                    }}>
                        {React.cloneElement(icon, { sx: { fontSize: 24 }})}
                    </Box>
                )}
                <Typography variant="caption" sx={{ 
                    color: '#64748b', 
                    fontWeight: 800, 
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem'
                }}>
                    {title}
                </Typography>
            </Box>
            
            <Typography variant="h3" sx={{ 
                fontWeight: 900, 
                color: '#0f172a', 
                mb: 1.5, 
                fontSize: '2.75rem', 
                letterSpacing: '-1px'
            }}>
                {value}
            </Typography>
            
            {subtitle && (
                <Box display="flex" alignItems="center" gap={1} sx={{ mt: 'auto' }}>
                    {trend && (
                        <Box sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            bgcolor: trend === 'up' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.06)',
                            p: 0.5,
                            borderRadius: '6px'
                        }}>
                            {trend === 'up' ? (
                                <TrendingUpIcon sx={{ color: COLORS.success, fontSize: 14 }} />
                            ) : (
                                <TrendingDownIcon sx={{ color: COLORS.slate, fontSize: 14 }} />
                            )}
                        </Box>
                    )}
                    <Typography variant="body2" sx={{ 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}>
                        {subtitle}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

// ─── Functional Modules Data ───
const modulesData = [
    {
        id: 'assets',
        title: 'Tài sản',
        desc: 'Quản lý công cụ dụng cụ, thiết bị văn phòng, bàn giao CCDC.',
        color: '#0284c7', // Sky Blue
        icon: <DevicesIcon sx={{ fontSize: 28 }} />,
        type: 'submenu',
        submenus: [
            { title: 'Danh sách tài sản', path: '/assets', desc: 'Quản lý danh sách, thông tin tài sản.' },
            { title: 'Bàn giao CCDC-BHLĐ', path: '/assets/handover-bhl', desc: 'Bàn giao công cụ dụng cụ, bảo hộ lao động.' },
            { title: 'Báo cáo CCDC-TSNT', path: '/assets/report-ccdc', desc: 'Báo cáo tổng hợp công cụ dụng cụ.' },
            { title: 'Chi tiết CCDC-TSNT', path: '/assets/detail-ccdc', desc: 'Chi tiết tài sản công cụ dụng cụ.' },
            { title: 'Báo cáo TBVP', path: '/assets/report-tbvp', desc: 'Báo cáo tổng hợp thiết bị văn phòng.' },
            { title: 'Chi tiết TBVP', path: '/assets/detail-tbvp', desc: 'Chi tiết thiết bị văn phòng.' },
            { title: 'Báo cáo hỏng', path: '/assets/broken-report', desc: 'Báo cáo công cụ dụng cụ hỏng.' }
        ]
    },
    {
        id: 'products',
        title: 'Hàng hóa',
        desc: 'Quản lý danh mục hàng hóa, vật tư, tồn kho tối thiểu.',
        color: '#0d9488', // Teal
        icon: <InventoryIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/products'
    },
    {
        id: 'audit',
        title: 'Kiểm kê kho',
        desc: 'Tạo phiếu kiểm kê, đối soát số lượng tồn kho thực tế.',
        color: '#4f46e5', // Indigo
        icon: <FactCheckIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/audit'
    },
    {
        id: 'settlement',
        title: 'Quyết toán',
        desc: 'Quyết toán vật tư, hàng hóa, đối chiếu chênh lệch XNT.',
        color: '#7c3aed', // Purple
        icon: <AssessmentIcon sx={{ fontSize: 28 }} />,
        type: 'submenu',
        submenus: [
            { title: 'Báo cáo 17 - XNT', path: '/inventory-report', desc: 'Báo cáo Xuất - Nhập - Tồn.' },
            { title: 'Báo cáo Xuất trong kỳ', path: '/detailed-outbound-report', desc: 'Chi tiết tình hình xuất kho.' },
            { title: 'Quyết toán vật tư', path: '/monthly-settlement', desc: 'Đối chiếu chênh lệch vật tư.' },
            { title: 'Quyết toán hàng hóa', path: '/goods-settlement', desc: 'Quyết toán chênh lệch hàng hóa.' }
        ]
    },
    {
        id: 'inbound',
        title: 'Nhập kho',
        desc: 'Thực hiện nhập kho vật tư, thiết bị, quản lý số phiếu nhập.',
        color: '#16a34a', // Green
        icon: <InputIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/inbound'
    },
    {
        id: 'qr-generator',
        title: 'Tạo QR code',
        desc: 'Tạo nhãn mã QR chuẩn, phân tách serial tự động.',
        color: '#2563eb', // Royal Blue
        icon: <QrCodeIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/qr-generator'
    },
    {
        id: 'qr-generator-hcm',
        title: 'Tạo QR code CN_HCM',
        desc: 'Tạo tem nhãn mã QR riêng biệt cho chi nhánh Hồ Chí Minh.',
        color: '#1e3a8a', // Deep Blue
        icon: <QrCodeIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/qr-generator-hcm'
    },
    {
        id: 'orders',
        title: 'Đặt hàng',
        desc: 'Đăng ký đặt hàng, theo dõi tiến độ phê duyệt đơn hàng.',
        color: '#f97316', // Orange
        icon: <OrderIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/orders'
    },
    {
        id: 'outbound',
        title: 'Xuất kho',
        desc: 'Thực hiện xuất kho vật tư, thiết bị cho nhân viên kỹ thuật.',
        color: '#ea580c', // Orange-Red
        icon: <ShippingIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/outbound'
    },
    {
        id: 'employee-returns',
        title: 'Trả hàng',
        desc: 'Tiếp nhận thiết bị thu hồi từ nhân viên, khách hàng trả lại.',
        color: '#db2777', // Pink
        icon: <ReturnIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/employee-returns'
    },
    {
        id: 'reports',
        title: 'Báo cáo',
        desc: 'Xuất file báo cáo bàn giao, biểu mẫu Excel, PDF in ấn.',
        color: '#0891b2', // Cyan
        icon: <AssessmentIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/reports'
    },
    {
        id: 'action-history',
        title: 'Lịch sử tác động',
        desc: 'Nhật ký ghi nhận lịch sử thao tác của các tài khoản.',
        color: '#4b5563', // Slate
        icon: <HistoryIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/action-history'
    },
    {
        id: 'employees',
        title: 'Nhân viên',
        desc: 'Quản lý danh sách nhân viên kỹ thuật, phân quyền tài khoản.',
        color: '#10b981', // Emerald
        icon: <PeopleIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/employees'
    },
    {
        id: 'settings',
        title: 'Thiết lập',
        desc: 'Cấu hình tham số hệ thống, RLS bảo mật cơ sở dữ liệu.',
        color: '#6b7280', // Gray
        icon: <SettingsIcon sx={{ fontSize: 28 }} />,
        type: 'route',
        path: '/settings'
    },
    {
        id: 'ai',
        title: 'Trợ lý AI',
        desc: 'Trợ lý AI thông minh hỗ trợ vận hành.',
        color: '#4f46e5', // Indigo
        icon: <AIIcon sx={{ fontSize: 28 }} />,
        type: 'ai'
    },
    {
        id: 'copyright',
        title: 'Thông tin bản quyền',
        desc: 'Quản lý sở hữu trí tuệ và thông tin nhà phát triển.',
        color: '#2563eb', // Blue
        icon: <CopyrightIcon sx={{ fontSize: 28 }} />,
        type: 'copyright'
    }
];

const Dashboard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { items: products, status: productStatus } = useSelector((state: RootState) => state.products);
    const { items: transactions, status: transactionStatus } = useSelector((state: RootState) => state.transactions);
    const { items: orders, status: orderStatus } = useSelector((state: RootState) => state.orders);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const stockMap = useSelector(selectStockMap);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Premium Portal Dashboard Menu States
    const [activeMenuTab, setActiveMenuTab] = useState(0); // 0: Chức năng, 1: Đánh dấu, 2: Tất cả
    const [markedModules, setMarkedModules] = useState<string[]>(['products', 'inbound', 'outbound', 'ai']);
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [placeholderModule, setPlaceholderModule] = useState<string | null>(null);
    const [copyrightOpen, setCopyrightOpen] = useState(false);
    const [submenuAnchorEl, setSubmenuAnchorEl] = useState<null | HTMLElement>(null);
    const [activeSubmenuModule, setActiveSubmenuModule] = useState<any | null>(null);

    const isLoading = productStatus === 'loading' || transactionStatus === 'loading' || inventoryStatus === 'loading';

    const refreshAll = useCallback(() => {
        dispatch(fetchProducts());
        dispatch(fetchTransactions());
        dispatch(fetchOrders());
        dispatch(fetchInventory());
        dispatch(fetchEmployees());
        setLastUpdated(new Date());
    }, [dispatch]);

    useEffect(() => {
        if (productStatus === 'idle') dispatch(fetchProducts());
        if (transactionStatus === 'idle') dispatch(fetchTransactions());
        if (orderStatus === 'idle') dispatch(fetchOrders());
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
        if (employeeStatus === 'idle') dispatch(fetchEmployees());
    }, [productStatus, transactionStatus, inventoryStatus, orderStatus, employeeStatus, dispatch]);

    // Chỉ set lastUpdated 1 lần khi mount (không phụ thuộc status để tránh vòng lặp)
    useEffect(() => {
        setLastUpdated(new Date());
    }, []);

    // Fetch again if tab becomes active and data is stale (> 5 minutes)
    useTabVisibility(refreshAll, 5 * 60 * 1000);

    const greeting = useMemo(() => {
        const hr = new Date().getHours();
        let text = 'Chào buổi tối';
        if (hr < 12) text = 'Chào buổi sáng';
        else if (hr < 14) text = 'Chào buổi trưa';
        else if (hr < 18) text = 'Chào buổi chiều';
        return `${text}, ${profile?.full_name || 'Lê Minh Công'} 👋`;
    }, [profile]);

    const toggleMark = useCallback((id: string) => {
        setMarkedModules(prev => 
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    }, []);

    const filteredModules = useMemo(() => {
        if (activeMenuTab === 0) {
            // Chức năng: shows administrative, hr, operations, sales, marketing, finance, procurement, production, logistics, executive, system
            return modulesData.filter(m => m.id !== 'copyright' && m.id !== 'ai');
        }
        if (activeMenuTab === 1) {
            // Đánh dấu: shows only modules that are in markedModules
            return modulesData.filter(m => markedModules.includes(m.id));
        }
        // Tất cả: shows all modules
        return modulesData;
    }, [activeMenuTab, markedModules]);

    const stats = useMemo(() => {
        if (!products.length && !transactions.length) return null;

        let total_inventory = 0;
        let low_stock_items = 0;
        let out_of_stock_items = 0;
        
        const reservedByProduct: Record<string, number> = {};
        orders.forEach(o => {
            if (o.status === 'pending' || o.status === 'approved') {
                reservedByProduct[o.product_id] = (reservedByProduct[o.product_id] || 0) + Number(o.quantity || 0);
            }
        });

        products.forEach(p => {
            const qty = stockMap[p.id] || 0;
            total_inventory += Math.max(0, qty); // only positive
            if (qty <= 0) out_of_stock_items++;
            else if (qty < 10) low_stock_items++;
        });

        const total_reserved = Object.values(reservedByProduct).reduce((a, b) => a + b, 0);

        const recent_transactions = [...transactions]
            .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
            .slice(0, 5);

        const weekly_stats: { date: string, inbound: number, outbound: number }[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = formatDate(d).substring(0, 5); // dd/mm
            weekly_stats.push({ date: dateStr, inbound: 0, outbound: 0 });
        }

        transactions.forEach(t => {
            const tDate = formatDate(t.date).substring(0, 5);
            const dayStat = weekly_stats.find(w => w.date === tDate);
            if (dayStat) {
                if (t.type === 'inbound') dayStat.inbound += t.quantity;
                else dayStat.outbound += t.quantity;
            }
        });

        const normalizeCategory = (cat: string) => {
            const trimmed = cat.trim();
            if (!trimmed) return 'Khác';
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        };

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            const cat = normalizeCategory(p.category || 'Khác');
            const qty = stockMap[p.id] || 0;
            catMap[cat] = (catMap[cat] || 0) + Math.max(0, qty);
        });
        const category_stats = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const employeeMap: Record<string, string> = {};
        employees.forEach(e => {
            if (e.id) employeeMap[e.id] = e.full_name;
            if (e.auth_user_id) employeeMap[e.auth_user_id] = e.full_name;
        });

        return {
            total_products: products.length,
            total_inventory,
            total_reserved,
            low_stock_items,
            out_of_stock_items,
            recent_transactions,
            weekly_stats,
            category_stats,
            employeeMap
        };
    }, [products, transactions, orders, stockMap, employees]);

    if (isLoading && !stats) return <DashboardSkeleton />;

    if (!stats) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={4} minHeight="50vh">
                <WarningIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2 }} />
                <Typography variant="h6" color="#475569" gutterBottom sx={{ fontWeight: 700 }}>
                    Không có dữ liệu
                </Typography>
                <Typography variant="body2" color="#64748b" align="center" sx={{ maxWidth: 400 }}>
                    Chưa có sản phẩm hoặc giao dịch nào trong hệ thống.
                </Typography>
            </Box>
        );
    }

    const pieData = stats.category_stats.length > 0
        ? stats.category_stats.map((c, i) => ({
            name: c.name || 'Khác',
            value: Number(c.value),
            color: [COLORS.success, COLORS.primary, COLORS.warning, COLORS.error, '#8b5cf6'][i % 5]
        }))
        : [{ name: 'Chưa có dữ liệu', value: 1, color: '#e2e8f0' }];

    const handleCardClick = (module: any, event?: React.MouseEvent<HTMLElement>) => {
        if (module.type === 'placeholder') {
            setPlaceholderModule(module.title);
        } else if (module.type === 'route') {
            navigate(module.path);
        } else if (module.type === 'ai') {
            window.dispatchEvent(new CustomEvent('open-ai-chatbot'));
        } else if (module.type === 'active') {
            setSelectedModule(prev => prev === module.id ? null : module.id);
        } else if (module.type === 'copyright') {
            setCopyrightOpen(true);
        } else if (module.type === 'submenu') {
            if (event) {
                setSubmenuAnchorEl(event.currentTarget);
                setActiveSubmenuModule(module);
            }
        }
    };

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 2, md: 4 }, position: 'relative' }}>
            
            {/* Soft Ambient Background Light Blur Spot */}
            <Box sx={{
                position: 'absolute',
                top: '-10%',
                right: '5%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha(COLORS.primary, 0.05)} 0%, rgba(255, 255, 255, 0) 70%)`,
                filter: 'blur(50px)',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* ── Welcome Greeting & Interactive Header ── */}
            <Box mb={1} sx={{ position: 'relative', zIndex: 1 }}>
                <Typography 
                    variant="h5" 
                    sx={{ 
                        fontWeight: 900, 
                        color: '#0f172a', 
                        letterSpacing: '-0.02em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.1rem' }
                    }}
                >
                    {greeting}
                </Typography>
            </Box>

            {/* ── Subtitle and Refresh ── */}
            <Box mb={4} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ position: 'relative', zIndex: 1 }}>
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: COLORS.success, animation: 'pulse 2s infinite' }} />
                    {lastUpdated
                        ? `Dữ liệu cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Hệ thống điều khiển trung tâm vận hành doanh nghiệp'
                    }
                </Typography>
                <Tooltip title="Làm mới toàn bộ dữ liệu">
                    <IconButton
                        onClick={refreshAll}
                        disabled={isLoading}
                        sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px', 
                            p: 1.5,
                            boxShadow: '0 4px 10px -4px rgba(0,0,0,0.05)',
                            transition: 'all 0.3s',
                            '&:hover': {
                                transform: 'rotate(45deg)',
                                bgcolor: '#f8fafc',
                                border: `1px solid ${COLORS.primary}`
                            }
                        }}
                    >
                        <RefreshIcon sx={{ 
                            fontSize: 18, 
                            color: isLoading ? '#94a3b8' : '#475569',
                            animation: isLoading ? 'spin 1.5s linear infinite' : 'none'
                        }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* ── Dynamic Navigation Tabs (Screenshot style) ── */}
            <Box mb={3} sx={{ position: 'relative', zIndex: 1 }}>
                <Tabs
                    value={activeMenuTab}
                    onChange={(e, val) => setActiveMenuTab(val)}
                    sx={{
                        minHeight: 'auto',
                        '& .MuiTabs-indicator': { display: 'none' },
                        '& .MuiTab-root': {
                            minHeight: 'auto',
                            py: 1,
                            px: 2.5,
                            mr: 1.5,
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: '#64748b',
                            bgcolor: '#f1f5f9',
                            transition: 'all 0.25s',
                            border: '1px solid transparent',
                            '&.Mui-selected': {
                                color: '#2563eb',
                                bgcolor: '#eff6ff',
                                border: '1px solid #bfdbfe'
                            },
                            '&:hover': {
                                bgcolor: '#e2e8f0',
                                color: '#0f172a'
                            }
                        }
                    }}
                >
                    <Tab label="Chức năng" />
                    <Tab label="Đánh dấu" />
                    <Tab label="Tất cả" />
                </Tabs>
            </Box>

            {/* ── Beautiful Grid of Modules Cards ── */}
            <Grid container spacing={3} mb={5} sx={{ position: 'relative', zIndex: 1 }}>
                {filteredModules.map((module) => {
                    const isMarked = markedModules.includes(module.id);
                    const isSelected = selectedModule === module.id;
                    return (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={module.id} sx={{ 
                            animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
                            '@keyframes fadeInUp': {
                                from: { opacity: 0, transform: 'translateY(15px)' },
                                to: { opacity: 1, transform: 'translateY(0)' }
                            }
                        }}>
                            <Paper
                                elevation={0}
                                onClick={(e) => handleCardClick(module, e)}
                                sx={{
                                    bgcolor: 'white',
                                    borderRadius: '24px',
                                    border: '1.5px solid',
                                    borderColor: isSelected ? alpha(module.color, 0.4) : '#f1f5f9',
                                    boxShadow: isSelected ? `0 10px 25px -5px ${alpha(module.color, 0.12)}` : '0 4px 20px rgba(0,0,0,0.012)',
                                    p: { xs: 3, md: 4 },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    height: '100%',
                                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        transform: 'translateY(-6px)',
                                        boxShadow: `0 15px 30px -5px ${alpha(module.color, 0.1)}`,
                                        borderColor: alpha(module.color, 0.35),
                                        '& .icon-box': {
                                            transform: 'scale(1.1) rotate(4deg)',
                                            boxShadow: `0 8px 20px ${alpha(module.color, 0.25)}`
                                        },
                                        '& .star-button': {
                                            opacity: 1
                                        }
                                    }
                                }}
                            >
                                {/* Star Bookmark Icon */}
                                <IconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleMark(module.id);
                                    }}
                                    className="star-button"
                                    sx={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                        opacity: isMarked ? 1 : 0,
                                        transition: 'all 0.2s',
                                        color: isMarked ? '#f59e0b' : '#cbd5e1',
                                        p: 0.5,
                                        '&:hover': { color: '#f59e0b', bgcolor: 'transparent' }
                                    }}
                                >
                                    {isMarked ? <StarIcon sx={{ fontSize: 20 }} /> : <StarBorderIcon sx={{ fontSize: 20 }} />}
                                </IconButton>

                                {/* Module Icon round-square box */}
                                <Box 
                                    className="icon-box"
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: '16px',
                                        bgcolor: module.color,
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mb: 3,
                                        boxShadow: `0 6px 16px ${alpha(module.color, 0.18)}`,
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                    }}
                                >
                                    {module.icon}
                                </Box>

                                {/* Module Title */}
                                <Typography 
                                    variant="h6" 
                                    sx={{ 
                                        fontWeight: 800, 
                                        color: '#0f172a', 
                                        mb: 1, 
                                        fontSize: '1.1rem',
                                        letterSpacing: '-0.3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 0.5
                                    }}
                                >
                                    {module.title}
                                    {module.type === 'submenu' && (
                                        <ChevronRightIcon sx={{ fontSize: 18, color: '#64748b', opacity: 0.8 }} />
                                    )}
                                </Typography>

                                {/* Module Description */}
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: '#64748b', 
                                        fontSize: '0.825rem', 
                                        lineHeight: 1.45,
                                        fontWeight: 500
                                    }}
                                >
                                    {module.desc}
                                </Typography>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>

            {/* ── DYNAMIC logistics stats section ── */}
            <Box sx={{ 
                position: 'relative', 
                zIndex: 1,
                animation: 'fadeInUpPanel 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes fadeInUpPanel': {
                    from: { opacity: 0, transform: 'translateY(25px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                }
            }}>
                <Divider sx={{ my: 5, borderColor: '#e2e8f0' }} />

                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 3, letterSpacing: '-0.5px' }}>
                    📊 Báo cáo kho vận thời gian thực
                </Typography>

                    {/* Premium Metric Grid */}
                    <Grid container spacing={3} mb={4}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <MetricCard 
                                title="TỔNG SẢN PHẨM" 
                                value={stats.total_products} 
                                icon={<InventoryIcon />} 
                                color={COLORS.primary}
                                subtitle="Tất cả danh mục hệ thống"
                                onClick={() => navigate('/products')}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <MetricCard 
                                title="TỒN KHO KHẢ DỤNG" 
                                value={formatNumber(stats.total_inventory)} 
                                icon={<ShippingIcon />} 
                                color={COLORS.success}
                                subtitle={`Đang giữ: ${formatNumber(stats.total_reserved || 0)} (chờ xuất)`}
                                trend="up"
                                onClick={() => navigate('/products')}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <MetricCard 
                                title="SẮP HẾT HÀNG" 
                                value={stats.low_stock_items} 
                                icon={<WarningIcon />} 
                                color={COLORS.warning}
                                subtitle="Dưới 10 sản phẩm"
                                onClick={() => navigate('/products?filter=low_stock')}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <MetricCard 
                                title="HẾT HÀNG" 
                                value={stats.out_of_stock_items} 
                                icon={<ErrorIcon />} 
                                color={COLORS.error}
                                subtitle="Kho đã cạn kiệt"
                                onClick={() => navigate('/products?filter=out_of_stock')}
                            />
                        </Grid>
                    </Grid>

                    {/* Graphs and Distribution Section */}
                    <Grid container spacing={4} mb={4}>
                        {/* Transaction Fluctuations Area Chart */}
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 4, 
                                    borderRadius: '28px', 
                                    height: 440, 
                                    border: '1px solid rgba(226, 232, 240, 0.6)', 
                                    bgcolor: 'rgba(255, 255, 255, 0.8)', 
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                                }}
                            >
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                                        Biến động giao dịch
                                    </Typography>
                                    <Chip size="small" label="7 ngày qua" sx={{ bgcolor: alpha(COLORS.primary, 0.06), color: COLORS.primary, fontWeight: 800, borderRadius: '8px', px: 1.5, py: 1.8, fontSize: '0.75rem' }} />
                                </Box>
                                <Box sx={{ height: 320, width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.weekly_stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600 }} />
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 12px 24px rgba(0, 0, 0, 0.06)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', fontFamily: "'Inter', sans-serif" }} 
                                                itemStyle={{ fontWeight: 700 }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#475569', fontFamily: "'Inter', sans-serif", fontWeight: 600 }} iconType="circle" />
                                            <Area type="monotone" dataKey="inbound" name="Nhập kho" stroke={COLORS.success} fillOpacity={1} fill="url(#colorIn)" strokeWidth={3} />
                                            <Area type="monotone" dataKey="outbound" name="Xuất kho" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorOut)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Stock Allocation Pie Chart */}
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 4, 
                                    borderRadius: '28px', 
                                    height: 440, 
                                    border: '1px solid rgba(226, 232, 240, 0.6)', 
                                    bgcolor: 'rgba(255, 255, 255, 0.8)', 
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                                }}
                            >
                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, letterSpacing: '-0.5px' }}>
                                    Phân bổ tồn kho
                                </Typography>
                                <Box sx={{ height: 310, position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0, 0, 0, 0.06)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', fontFamily: "'Inter', sans-serif" }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569', fontFamily: "'Inter', sans-serif", fontWeight: 600 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <Box sx={{
                                        position: 'absolute', top: '44%', left: '50%', transform: 'translate(-50%, -50%)',
                                        textAlign: 'center'
                                    }}>
                                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-1px' }}>
                                            {formatNumber(stats.total_inventory)}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem' }}>
                                            Tồn kho
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Bottom Real-time History logs */}
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 0, 
                                    borderRadius: '28px', 
                                    overflow: 'hidden', 
                                    border: '1px solid rgba(226, 232, 240, 0.6)', 
                                    bgcolor: 'rgba(255, 255, 255, 0.8)', 
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                                }}
                            >
                                <Box sx={{ px: 4, py: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                                        Lịch sử hoạt động gần đây
                                    </Typography>
                                    <Chip label="Real-time" size="small" sx={{ bgcolor: alpha(COLORS.success, 0.08), color: COLORS.success, fontWeight: 800, borderRadius: '8px', px: 1.5, fontSize: '0.72rem' }} />
                                </Box>
                                <List sx={{ p: 0 }}>
                                    {stats.recent_transactions.length === 0 ? (
                                        <ListItem>
                                            <ListItemText primary="Không tìm thấy giao dịch gần đây" sx={{ color: '#64748b', textAlign: 'center', py: 4, fontWeight: 500 }} />
                                        </ListItem>
                                    ) : stats.recent_transactions.map((t, idx) => (
                                        <ListItem 
                                            key={t.id ? `tx-${t.id}` : `recent-tx-${idx}`} 
                                            sx={{ 
                                                py: 2.5, 
                                                px: 4, 
                                                '&:hover': { bgcolor: 'rgba(248, 250, 252, 0.6)' }, 
                                                transition: '0.2s', 
                                                borderBottom: idx === stats.recent_transactions.length - 1 ? 'none' : '1px solid #f1f5f9' 
                                            }}
                                        >
                                            <Avatar sx={{
                                                p: 1, borderRadius: '16px', mr: 2.5, width: 44, height: 44,
                                                bgcolor: t.type === 'inbound' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(79, 70, 229, 0.06)',
                                                color: t.type === 'inbound' ? COLORS.success : COLORS.primary,
                                            }}>
                                                {t.type === 'inbound' ? <TrendingUpIcon fontSize="medium" /> : <TrendingDownIcon fontSize="medium" />}
                                            </Avatar>
                                            <ListItemText
                                                primary={
                                                    <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.975rem' }}>
                                                        {t.product?.name || (t as any).product_name || `Sản phẩm #${t.product_id}`}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.5, display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 500 }}>
                                                        {t.date ? formatDate(t.date) : 'N/A'}
                                                    </Typography>
                                                }
                                            />
                                            <Box textAlign="right">
                                                <Typography variant="body1" sx={{ fontWeight: 800, color: t.type === 'inbound' ? COLORS.success : '#0f172a', fontSize: '1.15rem' }}>
                                                    {t.type === 'inbound' ? '+' : '-'}{formatNumber(t.quantity)} sản phẩm
                                                </Typography>
                                                <Box display="flex" flexDirection="column" gap={0.2} sx={{ mt: 0.5 }}>
                                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: '0.75rem' }}>
                                                        {t.group_name || 'Kho chính'}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 500 }}>
                                                        Nhân viên: {stats.employeeMap[(t as any).created_by] || (t as any).created_by || 'Khuyết danh'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>

            {/* ── Submenu Popover for Assets & Settlement ── */}
            <Popover
                open={Boolean(submenuAnchorEl) && Boolean(activeSubmenuModule)}
                anchorEl={submenuAnchorEl}
                onClose={() => {
                    setSubmenuAnchorEl(null);
                    setActiveSubmenuModule(null);
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                PaperProps={{
                    sx: {
                        mt: 1.5,
                        borderRadius: '24px',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.1)',
                        width: '320px',
                        overflow: 'hidden',
                        bgcolor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                    }
                }}
            >
                {activeSubmenuModule && (
                    <Box sx={{ p: 1.5 }}>
                        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '10px',
                                bgcolor: activeSubmenuModule.color,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {React.cloneElement(activeSubmenuModule.icon as React.ReactElement<any>, { sx: { fontSize: 18 } })}
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', letterSpacing: '-0.2px' }}>
                                    {activeSubmenuModule.title}
                                </Typography>
                                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                    Chọn chức năng con để tiếp tục
                                </Typography>
                            </Box>
                        </Box>
                        
                        <Divider sx={{ my: 1, borderColor: '#e2e8f0' }} />
                        
                        <List sx={{ p: 0 }}>
                            {activeSubmenuModule.submenus.map((sub: any) => (
                                <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => {
                                            navigate(sub.path);
                                            setSubmenuAnchorEl(null);
                                            setActiveSubmenuModule(null);
                                        }}
                                        sx={{
                                            borderRadius: '12px',
                                            py: 1,
                                            px: 2,
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                bgcolor: alpha(activeSubmenuModule.color, 0.06),
                                                '& .sub-icon': {
                                                    color: activeSubmenuModule.color,
                                                    transform: 'translateX(3px)'
                                                }
                                            }
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>
                                                    {sub.title}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.2, fontWeight: 500 }}>
                                                    {sub.desc}
                                                </Typography>
                                            }
                                        />
                                        <ChevronRightIcon 
                                            className="sub-icon"
                                            sx={{ 
                                                fontSize: 16, 
                                                color: '#94a3b8', 
                                                transition: 'all 0.2s' 
                                            }} 
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}
            </Popover>

            {/* ── Dialog 1: Placeholder "Coming soon" Module ── */}
            <Dialog
                open={Boolean(placeholderModule)}
                onClose={() => setPlaceholderModule(null)}
                PaperProps={{
                    sx: {
                        borderRadius: '20px',
                        p: 1.5,
                        width: '400px',
                        maxWidth: '90%'
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#eab308' }} /> {placeholderModule}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontWeight: 500, color: '#475569', fontSize: '0.95rem' }}>
                        Tính năng phân hệ <b>"{placeholderModule}"</b> đang được phát triển tích hợp vào hệ thống ERP chung. Vui lòng quay lại sau!
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button 
                        onClick={() => setPlaceholderModule(null)} 
                        variant="contained" 
                        sx={{ bgcolor: '#0f172a', textTransform: 'none', fontWeight: 700, borderRadius: '10px', '&:hover': { bgcolor: '#1e293b' } }}
                    >
                        Đồng ý
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Dialog 2: Copyright & Developer Info ── */}
            <Dialog
                open={copyrightOpen}
                onClose={() => setCopyrightOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        p: 2,
                        width: '450px',
                        maxWidth: '90%'
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>ℹ️ Thông tin bản quyền</span>
                    <IconButton size="small" onClick={() => setCopyrightOpen(false)} sx={{ color: '#64748b' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.08)', width: 64, height: 64, mx: 'auto', mb: 2 }}>
                            <CopyrightIcon sx={{ color: '#2563eb', fontSize: 36 }} />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                            HỆ THỐNG QUẢN LÝ KHO ERP
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 700, mb: 3 }}>
                            Phiên bản Premium Logistics Theme v2.5.0
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ textAlign: 'left', px: 1 }}>
                            <Typography variant="body2" sx={{ mb: 1.2, color: '#475569', display: 'flex', gap: 1 }}>
                                👨‍💻 <b>Phát triển & Thiết kế:</b> Võ Thanh Song
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1.2, color: '#475569', display: 'flex', gap: 1 }}>
                                📞 <b>Số điện thoại liên hệ:</b> 0988.229.082
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1.2, color: '#475569', display: 'flex', gap: 1 }}>
                                🏢 <b>Đơn vị vận hành:</b> Chi nhánh Hồ Chí Minh / Tổng công ty
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#475569', display: 'flex', gap: 1 }}>
                                🔒 <b>Bản quyền:</b> Nghiêm cấm mọi hành vi sao chép nguồn hoặc phân phối trái phép khi chưa được sự cho phép bằng văn bản từ tác giả.
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button 
                        onClick={() => setCopyrightOpen(false)} 
                        variant="contained" 
                        sx={{ bgcolor: '#0f172a', textTransform: 'none', fontWeight: 800, borderRadius: '12px', px: 3, '&:hover': { bgcolor: '#1e293b' } }}
                    >
                        Đóng
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Dashboard;
