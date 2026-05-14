import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useConfig } from '../contexts/ConfigContext';

const ClientList: React.FC = () => {
  const navigate = useNavigate();
  const { clients, loading, error, loadClients, deleteClient, createClient } = useConfig();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const handleViewClient = (clientName: string) => {
    navigate(`/clients/${clientName}`);
  };

  const handleEditClient = (clientName: string) => {
    navigate(`/clients/${clientName}/edit`);
  };

  const handleDeleteClick = (clientName: string) => {
    setClientToDelete(clientName);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (clientToDelete) {
      try {
        await deleteClient(clientToDelete);
        setDeleteDialogOpen(false);
        setClientToDelete(null);
      } catch (error) {
        // Error is handled by context
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setClientToDelete(null);
  };

  const handleCreateClick = () => {
    setCreateDialogOpen(true);
    setNewClientName('');
    setCreateError(null);
  };

  const handleCreateConfirm = async () => {
    if (!newClientName.trim()) {
      setCreateError('Client name is required');
      return;
    }

    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(newClientName)) {
      setCreateError('Client name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens');
      return;
    }

    if (clients.includes(newClientName)) {
      setCreateError('Client already exists');
      return;
    }

    try {
      await createClient(newClientName);
      setCreateDialogOpen(false);
      navigate(`/clients/${newClientName}/edit`);
    } catch (error) {
      setCreateError('Failed to create client');
    }
  };

  const handleCreateCancel = () => {
    setCreateDialogOpen(false);
    setNewClientName('');
    setCreateError(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Client Configurations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create New Client
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" align="center">
              No clients configured
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              Create your first client configuration to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {clients.map((clientName) => (
            <Grid item xs={12} sm={6} md={4} key={clientName}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {clientName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Client configuration for {clientName}
                  </Typography>
                  <Box mt={2}>
                    <Chip
                      label="Active"
                      color="success"
                      size="small"
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => handleViewClient(clientName)}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEditClient(clientName)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteClick(clientName)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Client Configuration</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the configuration for "{clientToDelete}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Client Name"
            fullWidth
            variant="outlined"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value.toLowerCase())}
            error={!!createError}
            helperText={createError || 'Lowercase letters, numbers, and hyphens only. Must start with a letter.'}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateCancel}>Cancel</Button>
          <Button onClick={handleCreateConfirm} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientList;
