import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentTab = () => {
    if (location.pathname === '/' || location.pathname.startsWith('/clients')) {
      return 0;
    }
    return 0;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/clients');
        break;
      default:
        navigate('/clients');
    }
  };

  const handleCreateClient = () => {
    navigate('/create');
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
        <Tabs value={getCurrentTab()} onChange={handleTabChange} sx={{ flexGrow: 1 }}>
          <Tab label="Clients" />
        </Tabs>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClient}
          sx={{ ml: 2 }}
        >
          New Client
        </Button>
      </Box>
    </Box>
  );
};

export default Navigation;
