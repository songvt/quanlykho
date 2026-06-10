import React from 'react';
import { Button, Tooltip } from '@mui/material';
import type { ButtonProps } from '@mui/material';

export interface AppButtonProps extends Omit<ButtonProps, 'title'> {
  title: string; // The tooltip text to display on hover
  icon: React.ReactNode; // The icon inside the button
}

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ title, icon, sx, disabled, children, ...props }, ref) => {
    const button = (
      <Button
        {...props}
        ref={ref}
        disabled={disabled}
        sx={{
          minWidth: 40,
          width: 40,
          height: 40,
          borderRadius: '10px',
          p: 0,
          ...sx,
        }}
      >
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ sx?: any }>, {
              sx: { fontSize: 24, ...(icon.props as any)?.sx },
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
