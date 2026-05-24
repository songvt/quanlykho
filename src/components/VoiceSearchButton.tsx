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

    // Clean up recognition instance on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        };
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                console.error('Failed to abort speech recognition:', e);
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            notifyError('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
            return;
        }

        // Clean up any existing instance first
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {}
        }

        try {
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
                stopListening();
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                stopListening();
                
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
                    case 'aborted':
                        // Manual abort, ignore
                        break;
                    default:
                        notifyError('Lỗi nhận diện giọng nói: ' + event.error);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
                recognitionRef.current = null;
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err: any) {
            console.error('Failed to start speech recognition:', err);
            notifyError('Không thể khởi động nhận diện giọng nói.');
            setIsListening(false);
            recognitionRef.current = null;
        }
    }, [notifyError, notifyInfo, stopListening]);

    const toggleListen = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

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
