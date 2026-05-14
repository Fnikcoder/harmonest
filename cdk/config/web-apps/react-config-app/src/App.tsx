import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Container } from '@mui/material';
import { ConfigProvider } from './contexts/ConfigContext';
import ClientList from './components/ClientList';
import ClientEditor from './components/ClientEditor';
import Navigation from './components/Navigation';

function App() {
  return (
    <ConfigProvider>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Client Configuration Manager
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Navigation />
        
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<ClientList />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/:clientName" element={<ClientEditor />} />
            <Route path="/clients/:clientName/edit" element={<ClientEditor />} />
            <Route path="/create" element={<ClientEditor />} />
          </Routes>
        </Container>
      </Box>
    </ConfigProvider>
  );
}

export default App;
