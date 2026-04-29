import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, Tooltip, CircularProgress, InputAdornment } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { useNotification } from '../contexts/NotificationContext';

interface VoiceSearchButtonProps {
    onResult: (text: string) => void;
    isAdornment?: boolean;
}

export default function VoiceSearchButton({ onResult, isAdornment = true }: VoiceSearchButtonProps) {
    const [isListening, setIsListening] = useState(false);
    const { error: notifyError, info: notifyInfo } = useNotification();
    const recognitionRef = useRef<any>(null);
    const onResultRef = useRef(onResult);

    // Keep onResultRef up to date without re-running effects
    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'vi-VN';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                onResultRef.current(transcript);
                notifyInfo(`Nhận diện: "${transcript}"`);
            }
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
            
            switch (event.error) {
                case 'not-allowed':
                    notifyError('Quyền truy cập micro bị từ chối. Vui lòng kiểm tra cài đặt trình duyệt.');
                    break;
                case 'no-speech':
                    // Silent fail for no speech is usually better UX
                    break;
                case 'network':
                    notifyError('Lỗi kết nối mạng khi nhận diện giọng nói.');
                    break;
                default:
                    notifyError('Lỗi nhận diện giọng nói: ' + event.error);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        };
    }, [notifyError, notifyInfo]);

    const toggleListen = useCallback(() => {
        if (!recognitionRef.current) {
            notifyError('Trình duyệt của bạn không hỗ trợ hoặc chưa sẵn sàng cho nhận diện giọng nói.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (err: any) {
                if (err.name === 'InvalidStateError') {
                    // Already started, ignore
                } else {
                    console.error(err);
                    notifyError('Không thể khởi động nhận diện giọng nói.');
                }
            }
        }
    }, [isListening, notifyError]);

    const hasSupport = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    
    if (!hasSupport) {
        return null;
    }

    const btn = (
        <Tooltip title={isListening ? "Đang nghe... (Click để dừng)" : "Tìm kiếm bằng giọng nói"}>
            <IconButton 
                onClick={toggleListen} 
                color={isListening ? "error" : "primary"}
                sx={{ 
                    transition: 'all 0.3s ease',
                    transform: isListening ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: isListening ? '0 0 10px rgba(211, 47, 47, 0.4)' : 'none'
                }}
            >
                {isListening ? <CircularProgress size={24} color="error" /> : <MicIcon />}
            </IconButton>
        </Tooltip>
    );

    if (isAdornment) {
        return <InputAdornment position="end">{btn}</InputAdornment>;
    }

    return btn;
}
