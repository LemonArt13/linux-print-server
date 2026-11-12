import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { AppBar, Box, Button, Container, CssBaseline, Toolbar, Typography } from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import Home from './Home';
import Admin from './Admin';

function Layout({ children }: PropsWithChildren) {
  return <>
    <AppBar position="static" elevation={0} className="app-header">
      <Container maxWidth="lg"><Toolbar disableGutters className="app-toolbar">
        <Box className="brand-mark"><PrintRoundedIcon fontSize="small" /></Box>
        <Typography variant="subtitle1" className="brand-name">PrintFlow</Typography>
        <Button component={NavLink} to="/" end color="inherit" className="nav-button">Черга</Button>
        <Button component={NavLink} to="/admin" color="inherit" className="nav-button">Адмін</Button>
      </Toolbar></Container>
    </AppBar>
    <Container component="main" maxWidth="lg" className="main-container">{children}</Container>
  </>;
}

export default function App() {
  return <BrowserRouter><CssBaseline /><Routes>
    <Route path="/" element={<Layout><Home /></Layout>} />
    <Route path="/admin" element={<Layout><Admin /></Layout>} />
  </Routes></BrowserRouter>;
}
