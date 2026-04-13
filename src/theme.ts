import { createTheme } from '@mui/material/styles';

export function createAppTheme(prefersDarkMode: boolean) {
  return createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
      primary: {
        main: prefersDarkMode ? '#ff784f' : '#a83d1a',
      },
      background: {
        default: prefersDarkMode ? '#1e1a16' : '#f5ede3',
        paper:   prefersDarkMode ? '#2e2822' : '#fffaf5',
      },
      text: {
        primary:   prefersDarkMode ? '#f0e8dc' : '#2e261f',
        secondary: prefersDarkMode ? '#9cafb7' : '#4d6870',
      },
      divider: prefersDarkMode ? '#4a3e34' : '#e0c9b2',
    },
  });
}
