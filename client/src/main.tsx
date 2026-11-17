import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import App from './App';
import { globalStyles, theme } from './styles';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <GlobalStyles styles={globalStyles} />
    <App />
  </ThemeProvider>,
);
