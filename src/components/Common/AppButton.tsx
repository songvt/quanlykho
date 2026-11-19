import React from 'react';
import { Button, Tooltip } from '@mui/material';
import type { ButtonProps } from '@mui/material';

export interface AppButtonProps extends Omit<ButtonProps, 'title'> {
  title: string; // The tooltip text to display on hover
  icon: React.ReactNode; // The icon inside the button
}

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ title, icon, sx, disabled, children, ...props }, ref) => {
    const isContained = props.variant === 'contained';
    const button = (
      <Button
        {...props}
        ref={ref}
        aria-label={title}
        disabled={disabled}
        sx={{
          minWidth: 42,
          width: 42,
          height: 42,
          borderRadius: '9px',
          p: 0,
          boxShadow: isContained ? '0 2px 6px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: disabled ? 'none' : 'translateY(-1.5px)',
            boxShadow: isContained ? '0 4px 12px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.12)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          ...sx,
        }}
      >
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ sx?: any; size?: number }>, {
              sx: { fontSize: 22, ...(icon.props as any)?.sx },
              size: (icon.props as any)?.size || 22,
            })
          : icon}
        {children}
      </Button>
    );

    return (
      <Tooltip title={title} arrow>
        {disabled ? <span style={{ display: 'inline-block' }}>{button}</span> : button}
      </Tooltip>
    );
  }
);

AppButton.displayName = 'AppButton';
