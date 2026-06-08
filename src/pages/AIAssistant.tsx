import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Paper, Typography, IconButton, TextField, Stack, Avatar,
    Chip, Breadcrumbs, Link, CircularProgress, Container, Button
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import VoiceSearchButton from '../components/VoiceSearchButton';

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
};

const SUGGESTIONS = [
    "Có bao nhiêu tài sản đang quản lý?",
    "Có bao nhiêu tài sản bị hỏng?",
    "Ai đang sử dụng máy tính?",
    "Tìm sản phẩm modem trong danh mục hàng hóa",
    "Hướng dẫn xuất kho"
];

const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, idx) => {
        let content = line;
        
        // Handle headers
        const headerMatch = content.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const title = headerMatch[2];
            const variant = level === 1 ? 'subtitle1' : 'subtitle2';
            return <Typography key={idx} variant={variant} fontWeight="bold" sx={{ mt: 1.5, mb: 0.5, display: 'block' }}>{title}</Typography>;
        }

        // Handle list items
        const isListItem = content.trim().startsWith('- ') || content.trim().startsWith('* ');
        if (isListItem) {
            content = content.replace(/^[\s\-\*]+/, '');
            return (
                <Box key={idx} component="div" sx={{ ml: 2, mb: 0.5, display: 'list-item', listStyleType: 'disc' }}>
                    <Typography variant="body2" component="span" sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                        {parseInlineMarkdown(content)}
                    </Typography>
                </Box>
            );
        }

        return (
            <Typography key={idx} variant="body2" sx={{ minHeight: '1.2em', mb: 0.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
                {parseInlineMarkdown(content)}
            </Typography>
        );
    });
};

export default function AIAssistant() {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: 'Xin chào! Tôi là Gemini. Tôi có thể giúp gì cho công việc của bạn hôm nay?',
            sender: 'bot',
            timestamp: new Date()
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setIsTyping(true);

        try {
            // Send conversation history to backend api/gemini
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: updatedMessages.map(m => ({
                        sender: m.sender,
                        text: m.text
                    }))
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (err) {
                throw new Error('Không thể phân tích dữ liệu phản hồi từ máy chủ.');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Không thể kết nối đến máy chủ AI.');
            }

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: data.text || 'Đã có lỗi xảy ra. Vui lòng thử lại.',
                sender: 'bot',
                timestamp: new Date()
            }]);
        } catch (error: any) {
            console.error('Error contacting AI:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: error.message || 'Không thể kết nối với máy chủ AI. Hãy đảm bảo bạn đã cấu hình `GEMINI_API_KEY` trong biến môi trường.',
                sender: 'bot',
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 1, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            {/* Breadcrumbs */}
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <Link underline="hover" color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.85rem' }}>
                    Trang chủ
                </Link>
                <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Trợ lý AI
                </Typography>
            </Breadcrumbs>

            {/* Main Chat Panel */}
            <Paper
                elevation={3}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                    bgcolor: 'background.paper'
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #e2e8f0',
                        background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)'
                    }}
                >
                    <Box display="flex" alignItems="center" gap={2}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(-1)}
                            startIcon={<ArrowBackIcon />}
                            sx={{
                                textTransform: 'none',
                                color: '#475569',
                                borderColor: '#cbd5e1',
                                borderRadius: '8px',
                                '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
                            }}
                        >
                            Quay lại
                        </Button>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ bgcolor: '#2563eb', width: 36, height: 36 }}>
                                <SmartToyIcon sx={{ color: 'white', fontSize: 20 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle1" fontWeight="700" color="#0f172a" lineHeight={1.2}>
                                    Gemini AI
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                    <Typography variant="caption" color="text.secondary">
                                        Online
                                    </Typography>
                                </Stack>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Messages Body */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: 3,
                        bgcolor: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5
                    }}
                >
                    {messages.map((msg) => {
                        const isBot = msg.sender === 'bot';
                        return (
                            <Box
                                key={msg.id}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isBot ? 'flex-start' : 'flex-end',
                                    width: '100%'
                                }}
                            >
                                <Box display="flex" gap={1.5} maxWidth={{ xs: '90%', sm: '75%' }}>
                                    {isBot && (
                                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#e2e8f0', mt: 0.5 }}>
                                            <SmartToyIcon sx={{ fontSize: 18, color: '#475569' }} />
                                        </Avatar>
                                    )}
                                    <Box>
                                        <Paper
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                borderRadius: '16px',
                                                borderTopLeftRadius: isBot ? 2 : 16,
                                                borderTopRightRadius: isBot ? 16 : 2,
                                                bgcolor: isBot ? 'white' : '#2563eb',
                                                color: isBot ? '#1e293b' : 'white',
                                                border: isBot ? '1px solid #e2e8f0' : 'none',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                                '& p': { m: 0 },
                                                '& ul, & ol': { pl: 2, m: 0 },
                                                '& a': { color: isBot ? '#2563eb' : '#60a5fa' }
                                            }}
                                        >
                                            {isBot ? (
                                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                    {renderFormattedText(msg.text)}
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: '0.9rem' }}>
                                                    {msg.text}
                                                </Typography>
                                            )}
                                        </Paper>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: 'text.disabled',
                                                mt: 0.5,
                                                px: 0.5,
                                                display: 'block',
                                                textAlign: isBot ? 'left' : 'right'
                                            }}
                                        >
                                            {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}

                    {isTyping && (
                        <Box display="flex" gap={1.5} sx={{ width: '100%' }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#e2e8f0' }}>
                                <SmartToyIcon sx={{ fontSize: 18, color: '#475569' }} />
                            </Avatar>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        borderRadius: '16px',
                                        borderTopLeftRadius: 2,
                                        bgcolor: 'white',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        gap: 0.5,
                                        alignItems: 'center'
                                    }}
                                >
                                    <CircularProgress size={16} thickness={5} sx={{ color: '#2563eb' }} />
                                    <Typography variant="caption" sx={{ ml: 1, color: '#64748b', fontWeight: 500 }}>
                                        AI đang suy nghĩ...
                                    </Typography>
                                </Paper>
                            </Box>
                        </Box>
                    )}
                    <div ref={messagesEndRef} />
                </Box>

                {/* Suggestions & Input Area */}
                <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', bgcolor: 'white' }}>
                    {/* Suggestion Chips */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 1, flexWrap: 'nowrap', '&::-webkit-scrollbar': { display: 'none' } }}>
                        {SUGGESTIONS.map((s) => (
                            <Chip
                                key={s}
                                label={s}
                                onClick={() => handleSend(s)}
                                clickable
                                sx={{
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    border: '1px solid #cbd5e1',
                                    '&:hover': { bgcolor: '#e2e8f0' }
                                }}
                            />
                        ))}
                    </Stack>

                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                        <TextField
                            fullWidth
                            placeholder="Nhập câu hỏi của bạn cho Gemini AI..."
                            variant="outlined"
                            size="medium"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isTyping}
                            InputProps={{
                                sx: {
                                    borderRadius: '12px',
                                    bgcolor: '#f8fafc',
                                    '& fieldset': { borderColor: '#cbd5e1' },
                                    '&:hover fieldset': { borderColor: '#94a3b8' },
                                    '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                                },
                                endAdornment: (
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <VoiceSearchButton
                                            isAdornment={false}
                                            onResult={(text) => setInput(prev => (prev ? prev + ' ' : '') + text)}
                                        />
                                        <IconButton
                                            type="submit"
                                            color="primary"
                                            disabled={!input.trim() || isTyping}
                                            sx={{
                                                bgcolor: input.trim() ? '#2563eb' : 'transparent',
                                                color: input.trim() ? 'white' : '#94a3b8',
                                                '&:hover': { bgcolor: input.trim() ? '#1d4ed8' : '#e2e8f0' },
                                                width: 38,
                                                height: 38
                                            }}
                                        >
                                            <SendIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Stack>
                                )
                            }}
                        />
                    </form>
                </Box>
            </Paper>
        </Container>
    );
}
