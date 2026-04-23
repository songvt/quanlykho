import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Paper, Typography, IconButton, TextField, Stack, Avatar,
    Zoom, Fab, Chip, List, ListItem, ListItemText
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { selectStockMap } from '../../store/slices/inventorySlice';
import VoiceSearchButton from '../VoiceSearchButton';

type Message = {
    id: string;
    text: string | React.ReactNode;
    sender: 'user' | 'bot';
    timestamp: Date;
    options?: string[];
};

const normalizeStr = (str: string) => {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase().trim();
};

export default function AIChatbot() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: 'Xin chào! Tôi là Trợ lý AI Quản lý Kho. Bạn có thể hỏi tôi về:\n- 📦 Tồn kho sản phẩm (VD: "tồn kho modem")\n- 🔖 Tra cứu Serial (VD: "tìm serial 12345")\n- 👤 Lịch sử xuất/nhập (VD: "xuất cho Tuấn")\n- 🚀 Mở nhanh chức năng (VD: "xuất kho", "đặt hàng", "in biên bản")',
            sender: 'bot',
            timestamp: new Date(),
            options: ['Đặt hàng', 'Xuất kho', 'Trả hàng', 'In biên bản']
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const products = useSelector((state: RootState) => state.products.items);
    const stockMap = useSelector(selectStockMap);
    const transactions = useSelector((state: RootState) => state.transactions.items);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (text: string = input) => {
        if (!text.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Simulate network delay for AI realism
        setTimeout(() => {
            const response = processQuery(text);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: response,
                sender: 'bot',
                timestamp: new Date()
            }]);
        }, 600 + Math.random() * 800);
    };

    const processQuery = (query: string): React.ReactNode | string => {
        const normQuery = normalizeStr(query);

        // 0. INTENT: CHUYỂN TRANG / NAVIGATION
        const isCommand = (keywords: string[]) => keywords.some(kw => {
            const exactMatch = normQuery === kw;
            const startsWithCmd = ['mo', 'di den', 'vao', 'tao', 'giao dien'].some(prefix => normQuery === `${prefix} ${kw}` || normQuery.startsWith(`${prefix} ${kw} `));
            const containsInOption = ['đặt hàng', 'xuất kho', 'trả hàng', 'in biên bản'].map(normalizeStr).includes(normQuery);
            return exactMatch || startsWithCmd || (containsInOption && normQuery.includes(kw));
        });

        if (isCommand(['xuat kho', 'xuat'])) {
            setTimeout(() => { navigate('/outbound'); setOpen(false); }, 1500);
            return "Đang chuyển đến giao diện Xuất Kho...";
        }
        if (isCommand(['dat hang', 'don hang'])) {
            setTimeout(() => { navigate('/orders'); setOpen(false); }, 1500);
            return "Đang chuyển đến giao diện Đặt Hàng...";
        }
        if (isCommand(['tra hang', 'thu hoi'])) {
            setTimeout(() => { navigate('/employee-returns'); setOpen(false); }, 1500);
            return "Đang chuyển đến giao diện Trả Hàng...";
        }
        if (isCommand(['nhap kho', 'nhap'])) {
            setTimeout(() => { navigate('/inbound'); setOpen(false); }, 1500);
            return "Đang chuyển đến giao diện Nhập Kho...";
        }
        if (isCommand(['bao cao', 'thong ke', 'in bien ban', 'bien ban'])) {
            setTimeout(() => { navigate('/reports'); setOpen(false); }, 1500);
            return "Đang chuyển đến Báo Cáo (In Biên Bản)...";
        }
        if (isCommand(['trang chu', 'dashboard'])) {
            setTimeout(() => { navigate('/'); setOpen(false); }, 1500);
            return "Đang chuyển về Trang chủ...";
        }

        // 1. INTENT: TỒN KHO MẶT HÀNG
        if (normQuery.includes('ton kho') || normQuery.includes('con bao nhieu') || normQuery.includes('con khong') || normQuery.includes('so luong')) {
            const keywords = normQuery.replace(/(ton kho|con bao nhieu|con khong|so luong|cua|hang|kiem tra)/g, '').trim();
            if (!keywords) return "Bạn muốn kiểm tra tồn kho của sản phẩm nào? (VD: 'tồn kho cáp quang', 'tồn kho modem')";

            const searchWords = keywords.split(' ').filter(w => w.length > 0);
            let matchedProducts = products.filter(p => {
                const normName = normalizeStr(p.name);
                const normCode = normalizeStr(p.item_code);
                return searchWords.every(w => normName.includes(w) || normCode.includes(w));
            });

            if (matchedProducts.length === 0) {
                // Try to find suggestions by checking if ANY word matches
                const suggested = products.filter(p => {
                    const normName = normalizeStr(p.name);
                    return searchWords.some(w => w.length > 2 && normName.includes(w));
                }).slice(0, 3);
                
                let response = `Không tìm thấy sản phẩm nào khớp với từ khóa "${keywords}".`;
                if (suggested.length > 0) {
                    response += `\nCó phải bạn muốn tìm:\n` + suggested.map(s => `- ${s.name}`).join('\n');
                }
                return response;
            }

            return (
                <Box>
                    <Typography variant="body2" mb={1}>Kết quả tra cứu tồn kho cho <b>"{keywords}"</b>:</Typography>
                    <List disablePadding>
                        {matchedProducts.slice(0, 5).map(p => {
                            const qty = stockMap[p.id] || 0;
                            return (
                                <ListItem key={p.id} sx={{ px: 0, py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                                    <ListItemText 
                                        primary={<Typography variant="body2" fontWeight="600">{p.item_code} - {p.name}</Typography>}
                                        secondary={
                                            <Typography variant="caption" color={qty > 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                                                Tồn kho: {qty} {p.unit}
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                    {matchedProducts.length > 5 && <Typography variant="caption" color="text.secondary">Và {matchedProducts.length - 5} sản phẩm khác...</Typography>}
                </Box>
            );
        }

        // 2. INTENT: TRA CỨU SERIAL
        const hasSerialKeyword = normQuery.includes('serial') || normQuery.includes('imei') || normQuery.includes('sn');
        const isLikelySerial = /^[a-zA-Z0-9_-]{5,}$/.test(normQuery);

        if (hasSerialKeyword || isLikelySerial) {
            // Extract potential serial
            let serialKeyword = '';
            if (hasSerialKeyword) {
                const words = normQuery.split(' ');
                for (let i = 0; i < words.length; i++) {
                    if (['serial', 'imei', 'sn'].includes(words[i]) && i + 1 < words.length) {
                        serialKeyword = words[i+1];
                        break;
                    }
                }
                if (!serialKeyword) {
                    serialKeyword = normQuery.replace(/(tim|tra cuu|serial|imei|sn)/g, '').trim();
                }
            } else {
                serialKeyword = normQuery.trim();
            }

            if (serialKeyword) {
                // Find transactions with this serial
                const matchedTxs = transactions.filter(tx => 
                    tx.serial_code && normalizeStr(tx.serial_code).includes(serialKeyword)
                ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (matchedTxs.length > 0) {
                    const currentStatus = matchedTxs[0];
                    const isCurrentlyOut = currentStatus.type === 'outbound';
                    const statusText = isCurrentlyOut ? `Đã xuất cho ${currentStatus.group_name || 'nhân viên'}` : `Tồn kho (Nhập bởi ${currentStatus.user_name || 'hệ thống'})`;
                    const statusColor = isCurrentlyOut ? 'error.main' : 'success.main';

                    return (
                        <Box>
                            <Typography variant="body2" mb={0.5}>Tra cứu Serial <b>"{serialKeyword}"</b>:</Typography>
                            <Typography variant="body2" fontWeight="bold" color={statusColor} mb={1}>
                                👉 Tình trạng: {statusText}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Lịch sử chi tiết:</Typography>
                            <List disablePadding>
                                {matchedTxs.map(tx => {
                                    const isOut = tx.type === 'outbound';
                                    return (
                                        <ListItem key={tx.id} sx={{ px: 0, py: 0.5, borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                                            <ListItemText 
                                                primary={
                                                    <Typography variant="body2" fontWeight="600" color={isOut ? 'error.main' : 'success.main'}>
                                                        {isOut ? 'Xuất kho' : 'Nhập kho'} - {new Date(tx.date).toLocaleDateString('vi-VN')}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <React.Fragment>
                                                        <Typography variant="caption" display="block">SP: {tx.product?.name}</Typography>
                                                        <Typography variant="caption" display="block">Mã GD: #{tx.id.substring(0, 8)}</Typography>
                                                        {isOut ? <Typography variant="caption" display="block">Giao cho: {tx.group_name}</Typography> : <Typography variant="caption" display="block">NV Thực hiện: {tx.user_name || 'Hệ thống'}</Typography>}
                                                    </React.Fragment>
                                                }
                                            />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Box>
                    );
                } else if (hasSerialKeyword) {
                    return `Không tìm thấy lịch sử giao dịch nào cho Serial chứa "${serialKeyword}".`;
                }
            } else if (hasSerialKeyword) {
                return "Bạn muốn tìm số serial nào? (VD: 'serial SN123456')";
            }
        }

        // 3. INTENT: NHÂN VIÊN
        if (normQuery.includes('nhan vien') || normQuery.includes('lich su cua') || normQuery.includes('giao cho') || normQuery.includes('xuat cho')) {
            const keywords = normQuery.replace(/(nhan vien|lich su cua|giao cho|xuat cho)/g, '').trim();
            if (!keywords) return "Bạn muốn tra cứu nhân viên/nhóm nào? (VD: 'nhân viên Tuấn', 'xuất cho anh Bình')";

            const matchedTxs = transactions.filter(tx => 
                tx.type === 'outbound' && tx.group_name && normalizeStr(tx.group_name).includes(keywords)
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (matchedTxs.length === 0) {
                return `Không tìm thấy phiếu xuất kho nào giao cho "${keywords}".`;
            }

            const now = new Date();
            const thisMonthTxs = matchedTxs.filter(tx => {
                const d = new Date(tx.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            const totalThisMonth = thisMonthTxs.reduce((sum, tx) => sum + (tx.quantity || 1), 0);
            
            const employeeName = matchedTxs[0].group_name;

            return (
                <Box>
                    <Typography variant="body2" mb={0.5}>Tra cứu nhân viên <b>{employeeName}</b>:</Typography>
                    <Typography variant="body2" fontWeight="bold" color="primary" mb={1}>
                        👉 Tổng xuất trong tháng này: {totalThisMonth} sản phẩm
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Giao dịch gần đây:</Typography>
                    <List disablePadding>
                        {matchedTxs.slice(0, 5).map(tx => (
                            <ListItem key={tx.id} sx={{ px: 0, py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                                <ListItemText 
                                    primary={
                                        <Typography variant="body2" fontWeight="600">
                                            #{tx.id.substring(0, 8)} - {new Date(tx.date).toLocaleDateString('vi-VN')}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption">
                                            {tx.product?.name} ({tx.quantity} {tx.product?.unit})
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                    {matchedTxs.length > 5 && <Typography variant="caption" color="text.secondary">Và {matchedTxs.length - 5} giao dịch khác...</Typography>}
                </Box>
            );
        }
        
        // 4. INTENT: HÔM NAY (TODAY'S TXS)
        if (normQuery.includes('hom nay')) {
            const today = new Date().toLocaleDateString('en-US'); // standard formatting comparison or just date check
            const todayTxs = transactions.filter(tx => new Date(tx.date).toLocaleDateString('en-US') === today);
            
            if (todayTxs.length === 0) return "Hôm nay chưa có giao dịch xuất nhập kho nào.";
            
            const inCount = todayTxs.filter(t => t.type === 'inbound').length;
            const outCount = todayTxs.filter(t => t.type === 'outbound').length;
            return `Hôm nay có tổng cộng ${todayTxs.length} giao dịch:\n- ${inCount} phiếu Nhập kho\n- ${outCount} phiếu Xuất kho.`;
        }

        // 5. FALLBACK TO PRODUCT SEARCH
        // Nếu không khớp intent nào ở trên, thử tìm xem người dùng có gõ tên sản phẩm không
        const searchWords = normQuery.split(' ').filter(w => w.length > 0);
        if (searchWords.length > 0) {
            const fallbackProducts = products.filter(p => {
                const normName = normalizeStr(p.name);
                const normCode = normalizeStr(p.item_code);
                return searchWords.every(w => normName.includes(w) || normCode.includes(w));
            });

            if (fallbackProducts.length > 0) {
                return (
                    <Box>
                        <Typography variant="body2" mb={1}>
                            Có phải bạn muốn tra cứu tồn kho cho <b>"{query}"</b>?
                        </Typography>
                        <List disablePadding>
                            {fallbackProducts.slice(0, 5).map(p => {
                                const qty = stockMap[p.id] || 0;
                                return (
                                    <ListItem key={p.id} sx={{ px: 0, py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
                                        <ListItemText 
                                            primary={<Typography variant="body2" fontWeight="600">{p.item_code} - {p.name}</Typography>}
                                            secondary={
                                                <Typography variant="caption" color={qty > 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                                                    Tồn kho: {qty} {p.unit}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                        {fallbackProducts.length > 5 && (
                            <Typography variant="caption" color="text.secondary">
                                Và {fallbackProducts.length - 5} sản phẩm khác... Hãy gõ thêm từ khóa để tìm chính xác hơn.
                            </Typography>
                        )}
                    </Box>
                );
            }
        }

        // FALLBACK TỔNG CHUNG
        return "Xin lỗi, tôi chưa hiểu ý bạn. Bạn có thể thử các mẫu câu sau:\n- 'Tồn kho [Tên SP]'\n- 'Tra cứu serial [Số Serial]'\n- 'Lịch sử nhân viên [Tên NV]'\n- Hoặc yêu cầu mở trang: 'xuất kho', 'đặt hàng', 'báo cáo'...";
    };

    return (
        <>
            {/* Floating Action Button */}
            <Zoom in={!open}>
                <Fab
                    color="primary"
                    aria-label="AI Chat"
                    onClick={() => setOpen(true)}
                    sx={{
                        position: 'fixed',
                        bottom: { xs: 80, sm: 24 },
                        right: { xs: 16, sm: 24 },
                        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                        background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                        '&:hover': { background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)' }
                    }}
                >
                    <SupportAgentIcon sx={{ color: 'white' }} />
                </Fab>
            </Zoom>

            {/* Chat Window */}
            <Zoom in={open}>
                <Paper
                    elevation={6}
                    sx={{
                        position: 'fixed',
                        bottom: { xs: 70, sm: 24 },
                        right: { xs: 10, sm: 24 },
                        width: { xs: 'calc(100% - 20px)', sm: 360 },
                        height: 500,
                        maxHeight: 'calc(100vh - 100px)',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        overflow: 'hidden',
                        zIndex: 1300,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
                    }}
                >
                    {/* Header */}
                    <Box sx={{ 
                        background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                        p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ bgcolor: 'white', width: 32, height: 32 }}>
                                <SmartToyIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle1" fontWeight="bold" color="white" lineHeight={1.2}>
                                    Trợ lý AI
                                </Typography>
                                <Typography variant="caption" color="rgba(255,255,255,0.8)">
                                    Trực tuyến
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Chat Area */}
                    <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {messages.map((msg) => {
                            const isBot = msg.sender === 'bot';
                            return (
                                <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end' }}>
                                    <Box display="flex" gap={1} maxWidth="85%">
                                        {isBot && (
                                            <Avatar sx={{ width: 28, height: 28, bgcolor: '#e2e8f0', mt: 0.5 }}>
                                                <SmartToyIcon sx={{ fontSize: 16, color: '#475569' }} />
                                            </Avatar>
                                        )}
                                        <Box>
                                            <Paper sx={{ 
                                                p: 1.5, 
                                                borderRadius: 2, 
                                                borderTopLeftRadius: isBot ? 4 : 16,
                                                borderTopRightRadius: isBot ? 16 : 4,
                                                bgcolor: isBot ? 'white' : '#2563eb',
                                                color: isBot ? 'text.primary' : 'white',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                wordBreak: 'break-word',
                                                whiteSpace: 'pre-line'
                                            }}>
                                                {typeof msg.text === 'string' ? <Typography variant="body2">{msg.text}</Typography> : msg.text}
                                            </Paper>
                                            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, px: 0.5, display: 'block', textAlign: isBot ? 'left' : 'right' }}>
                                                {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {msg.options && (
                                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                                            {msg.options.map(opt => (
                                                <Chip 
                                                    key={opt} 
                                                    label={opt} 
                                                    size="small" 
                                                    onClick={() => handleSend(opt)}
                                                    sx={{ bgcolor: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', '&:hover': { bgcolor: '#e2e8f0' } }}
                                                />
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            );
                        })}
                        {isTyping && (
                            <Box display="flex" gap={1}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#e2e8f0' }}>
                                    <SmartToyIcon sx={{ fontSize: 16, color: '#475569' }} />
                                </Avatar>
                                <Paper sx={{ p: 1.5, borderRadius: 2, borderTopLeftRadius: 4, bgcolor: 'white', display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#cbd5e1', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#cbd5e1', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#cbd5e1', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                                </Paper>
                            </Box>
                        )}
                        <div ref={messagesEndRef} />
                    </Box>

                    {/* Input Area */}
                    <Box sx={{ p: 1.5, bgcolor: 'white', borderTop: '1px solid #e2e8f0' }}>
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                            <TextField
                                fullWidth
                                placeholder="Hỏi AI tra cứu..."
                                variant="outlined"
                                size="small"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                InputProps={{
                                    sx: { borderRadius: 3, bgcolor: '#f1f5f9', '& fieldset': { border: 'none' } },
                                    endAdornment: (
                                        <>
                                            <VoiceSearchButton 
                                                isAdornment={false} 
                                                onResult={(text) => setInput(prev => (prev ? prev + ' ' : '') + text)} 
                                            />
                                            <IconButton type="submit" color="primary" disabled={!input.trim() || isTyping}>
                                                <SendIcon />
                                            </IconButton>
                                        </>
                                    )
                                }}
                            />
                        </form>
                    </Box>
                </Paper>
            </Zoom>
            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
        </>
    );
}
