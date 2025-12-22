import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box p={4} display="flex" flexDirection="column" alignItems="center" bgcolor="#ffebee" minHeight="100vh">
                    <Typography variant="h3" color="error" gutterBottom>Đã xảy ra lỗi!</Typography>
                    <Typography variant="h6" gutterBottom>{this.state.error && this.state.error.toString()}</Typography>
                    <Box component="pre" p={2} bgcolor="#000" color="#0f0" overflow="auto" maxWidth="100%">
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </Box>
                    <Button variant="contained" color="primary" onClick={() => window.location.reload()} sx={{ mt: 3 }}>
                        Tải lại trang
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
