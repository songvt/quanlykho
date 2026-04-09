import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Snackbar, Alert, type AlertColor } from '@mui/material';

interface NotificationContextType {
  notify: (message: string, severity?: AlertColor) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  const notify = useCallback((msg: string, sev: AlertColor = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const success = useCallback((msg: string) => notify(msg, 'success'), [notify]);
  const error = useCallback((msg: string) => notify(msg, 'error'), [notify]);
  const info = useCallback((msg: string) => notify(msg, 'info'), [notify]);
  const warning = useCallback((msg: string) => notify(msg, 'warning'), [notify]);

  const handleClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{ notify, success, error, info, warning }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
            onClose={handleClose} 
            severity={severity} 
            variant="filled"
            sx={{ 
                width: '100%', 
                borderRadius: 2,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
