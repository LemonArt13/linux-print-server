import { commonStyles } from './styles';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { AppBar, Box, Button, Container, CssBaseline, Toolbar, Typography } from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import Home from './Home';
import Admin from './Admin';

function Layout({ children }: PropsWithChildren) {
  return <>
    <AppBar position="static" elevation={0} sx={commonStyles.appHeader}>
      <Container maxWidth="lg"><Toolbar disableGutters sx={commonStyles.appToolbar}>
        <Box sx={commonStyles.brandMark}><PrintRoundedIcon fontSize="small" /></Box>
        <Typography variant="subtitle1" sx={commonStyles.brandName}>PrintFlow</Typography>
        <Button component={NavLink} to="/" end color="inherit" sx={commonStyles.navButton}>Документи</Button>
        <Button component={NavLink} to="/admin" color="inherit" sx={commonStyles.navButton}>Адмін</Button>
      </Toolbar></Container>
    </AppBar>
    <Container component="main" maxWidth="lg" sx={commonStyles.mainContainer}>{children}</Container>
  </>;
}

export default function App() {
  return <BrowserRouter><CssBaseline /><Routes>
    <Route path="/" element={<Layout><Home /></Layout>} />
    <Route path="/admin" element={<Layout><Admin /></Layout>} />
  </Routes></BrowserRouter>;
}
