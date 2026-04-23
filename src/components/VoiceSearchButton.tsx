import { useState, useEffect, useRef } from 'react';
import { IconButton, Tooltip, CircularProgress, InputAdornment } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { useNotification } from '../contexts/NotificationContext';

interface VoiceSearchButtonProps {
    onResult: (text: string) => void;
    isAdornment?: boolean;
}

export default function VoiceSearchButton({ onResult, isAdornment = true }: VoiceSearchButtonProps) {
    const [isListening, setIsListening] = useState(false);
    const { error: notifyError } = useNotification();
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'vi-VN';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onResult(transcript);
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                if (event.error !== 'no-speech') {
                    notifyError('Lỗi nhận diện giọng nói: ' + event.error);
                }
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, [onResult, notifyError]);

    const toggleListen = () => {
        if (!recognitionRef.current) {
            notifyError('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (err) {
                console.error(err);
            }
        }
    };

    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
        return null;
    }

    const btn = (
        <Tooltip title={isListening ? "Đang nghe..." : "Tìm kiếm bằng giọng nói"}>
            <IconButton onClick={toggleListen} color={isListening ? "error" : "primary"}>
                {isListening ? <CircularProgress size={24} color="error" /> : <MicIcon />}
            </IconButton>
        </Tooltip>
    );

    if (isAdornment) {
        return <InputAdornment position="end">{btn}</InputAdornment>;
    }

    return btn;
}
