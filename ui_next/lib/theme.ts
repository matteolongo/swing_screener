import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1f4b99',
    },
    secondary: {
      main: '#2e7d32',
    },
    background: {
      default: '#f5f6f8',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 700 },
    h2: { fontSize: '1.2rem', fontWeight: 600 },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700 },
      },
    },
  },
});

export default theme;
