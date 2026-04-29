import React from 'react';
import { Box, Button, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
          gap: 2,
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h2" fontWeight={800} color="primary">
          404
        </Typography>
        <Typography variant="h5" color="text.secondary">
          Rất tiếc! Trang bạn đang tìm kiếm không tồn tại.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Có thể đường dẫn đã lỗi thời hoặc trang đã được di chuyển.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/')}
          sx={{
            borderRadius: 3,
            px: 5,
            py: 1.5,
            textTransform: 'none',
            fontSize: '1.1rem',
            fontWeight: 700,
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          }}
        >
          Quay lại Trang chủ
        </Button>
      </Box>
    </Container>
  );
};

export default NotFound;
