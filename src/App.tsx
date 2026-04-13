import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { router } from './router/router';
import { createAppTheme } from './theme';

export default function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createAppTheme(prefersDarkMode), [prefersDarkMode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
