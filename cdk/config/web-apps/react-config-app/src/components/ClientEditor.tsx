import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useConfig, ClientConfig } from '../contexts/ConfigContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`client-tabpanel-${index}`}
      aria-labelledby={`client-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ClientEditor: React.FC = () => {
  const { clientName } = useParams<{ clientName: string }>();
  const navigate = useNavigate();
  const { currentConfig, loading, error, loadClient, saveClient, validateConfig } = useConfig();
  
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [newDomain, setNewDomain] = useState('');

  const isCreateMode = !clientName;

  useEffect(() => {
    if (clientName) {
      loadClient(clientName);
    } else {
      // Create mode - initialize with empty config
      const emptyConfig: ClientConfig = {
        client: {
          name: '',
          displayName: '',
          domains: {
            primary: '',
          },
          email: {
            noreply: '',
          },
          aws: {
            profile: '',
            region: 'eu-central-1',
          },
        },
        environments: {
          prod: {
            enabled: true,
          },
        },
      };
      setConfig(emptyConfig);
      setIsEditing(true);
    }
  }, [clientName, loadClient]);

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setSaveError(null);
    setValidationError(null);
  };

  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/clients');
    } else {
      setConfig(currentConfig);
      setIsEditing(false);
      setSaveError(null);
      setValidationError(null);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaveError(null);
    setValidationError(null);

    // Validate configuration
    const isValid = await validateConfig(config);
    if (!isValid) {
      setValidationError('Configuration validation failed. Please check your settings.');
      return;
    }

    try {
      const clientNameToSave = isCreateMode ? config.client.name : clientName!;
      await saveClient(clientNameToSave, config);
      
      if (isCreateMode) {
        navigate(`/clients/${clientNameToSave}`);
      } else {
        setIsEditing(false);
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save configuration');
    }
  };

  const updateConfig = (path: string[], value: any) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let current = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setConfig(newConfig);
  };

  const addDomain = () => {
    if (!config || !newDomain.trim()) return;
    
    const additional = config.client.domains.additional || [];
    updateConfig(['client', 'domains', 'additional'], [...additional, newDomain.trim()]);
    setNewDomain('');
  };

  const removeDomain = (index: number) => {
    if (!config) return;
    
    const additional = config.client.domains.additional || [];
    const newAdditional = additional.filter((_, i) => i !== index);
    updateConfig(['client', 'domains', 'additional'], newAdditional);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!config) {
    return (
      <Alert severity="error">
        Failed to load client configuration
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isCreateMode ? 'Create New Client' : `Client: ${config.client.displayName || config.client.name}`}
        </Typography>
        
        <Box>
          {!isEditing ? (
            <>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEdit}
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/clients')}
              >
                Back to List
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{ mr: 1 }}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}

      {validationError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {validationError}
        </Alert>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Basic Info" />
          <Tab label="Domains" />
          <Tab label="Email" />
          <Tab label="AWS" />
          <Tab label="Features" />
          <Tab label="Environments" />
        </Tabs>

        {/* Basic Info Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client Name"
                value={config.client.name}
                onChange={(e) => updateConfig(['client', 'name'], e.target.value)}
                disabled={!isEditing || !isCreateMode}
                helperText={isCreateMode ? "Lowercase letters, numbers, and hyphens only" : "Cannot be changed after creation"}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Display Name"
                value={config.client.displayName}
                onChange={(e) => updateConfig(['client', 'displayName'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={config.client.description || ''}
                onChange={(e) => updateConfig(['client', 'description'], e.target.value)}
                disabled={!isEditing}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Domains Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Primary Domain"
                value={config.client.domains.primary}
                onChange={(e) => updateConfig(['client', 'domains', 'primary'], e.target.value)}
                disabled={!isEditing}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="WWW Domain"
                value={config.client.domains.www || ''}
                onChange={(e) => updateConfig(['client', 'domains', 'www'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Development Domain"
                value={config.client.domains.dev || ''}
                onChange={(e) => updateConfig(['client', 'domains', 'dev'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Staging Domain"
                value={config.client.domains.staging || ''}
                onChange={(e) => updateConfig(['client', 'domains', 'staging'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Domain"
                value={config.client.domains.api || ''}
                onChange={(e) => updateConfig(['client', 'domains', 'api'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Admin Domain"
                value={config.client.domains.admin || ''}
                onChange={(e) => updateConfig(['client', 'domains', 'admin'], e.target.value)}
                disabled={!isEditing}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Additional Domains
              </Typography>

              {isEditing && (
                <Box display="flex" gap={1} mb={2}>
                  <TextField
                    size="small"
                    label="Add domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addDomain}
                    disabled={!newDomain.trim()}
                  >
                    Add
                  </Button>
                </Box>
              )}

              <Box display="flex" flexWrap="wrap" gap={1}>
                {(config.client.domains.additional || []).map((domain, index) => (
                  <Chip
                    key={index}
                    label={domain}
                    onDelete={isEditing ? () => removeDomain(index) : undefined}
                    deleteIcon={<DeleteIcon />}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Email Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="No-Reply Email"
                value={config.client.email.noreply}
                onChange={(e) => updateConfig(['client', 'email', 'noreply'], e.target.value)}
                disabled={!isEditing}
                required
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Support Email"
                value={config.client.email.support || ''}
                onChange={(e) => updateConfig(['client', 'email', 'support'], e.target.value)}
                disabled={!isEditing}
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Admin Email"
                value={config.client.email.admin || ''}
                onChange={(e) => updateConfig(['client', 'email', 'admin'], e.target.value)}
                disabled={!isEditing}
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Notifications Email"
                value={config.client.email.notifications || ''}
                onChange={(e) => updateConfig(['client', 'email', 'notifications'], e.target.value)}
                disabled={!isEditing}
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="From Name"
                value={config.client.email.fromName || ''}
                onChange={(e) => updateConfig(['client', 'email', 'fromName'], e.target.value)}
                disabled={!isEditing}
                helperText="Display name for outgoing emails"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* AWS Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="AWS Profile"
                value={config.client.aws.profile}
                onChange={(e) => updateConfig(['client', 'aws', 'profile'], e.target.value)}
                disabled={!isEditing}
                required
                helperText="AWS CLI profile name"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="AWS Region"
                value={config.client.aws.region}
                onChange={(e) => updateConfig(['client', 'aws', 'region'], e.target.value)}
                disabled={!isEditing}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="AWS Account ID"
                value={config.client.aws.accountId || ''}
                onChange={(e) => updateConfig(['client', 'aws', 'accountId'], e.target.value)}
                disabled={!isEditing}
                helperText="12-digit AWS account ID"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="KMS Key ID"
                value={config.client.aws.kmsKeyId || ''}
                onChange={(e) => updateConfig(['client', 'aws', 'kmsKeyId'], e.target.value)}
                disabled={!isEditing}
                helperText="KMS key for encryption"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Features Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Check-in Features
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.checkin?.enabled ?? true}
                        onChange={(e) => updateConfig(['client', 'features', 'checkin', 'enabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable Check-in"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Deadline Hours"
                    type="number"
                    value={config.client.features?.checkin?.deadlineHours ?? 25}
                    onChange={(e) => updateConfig(['client', 'features', 'checkin', 'deadlineHours'], parseInt(e.target.value))}
                    disabled={!isEditing}
                    helperText="Hours before check-in when updates are no longer allowed"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.checkin?.qrCodeEnabled ?? true}
                        onChange={(e) => updateConfig(['client', 'features', 'checkin', 'qrCodeEnabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable QR Code Generation"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.checkin?.documentUpload?.enabled ?? true}
                        onChange={(e) => updateConfig(['client', 'features', 'checkin', 'documentUpload', 'enabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable Document Upload"
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Reservations Features
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.reservations?.syncEnabled ?? true}
                        onChange={(e) => updateConfig(['client', 'features', 'reservations', 'syncEnabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable Reservation Sync"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Sync Interval (minutes)"
                    type="number"
                    value={config.client.features?.reservations?.syncIntervalMinutes ?? 30}
                    onChange={(e) => updateConfig(['client', 'features', 'reservations', 'syncIntervalMinutes'], parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Listings Features
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.listings?.syncEnabled ?? true}
                        onChange={(e) => updateConfig(['client', 'features', 'listings', 'syncEnabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable Listings Sync"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.client.features?.listings?.publicListings ?? false}
                        onChange={(e) => updateConfig(['client', 'features', 'listings', 'publicListings'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Enable Public Listings"
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Environments Tab */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>
            Environment Configurations
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Configure environment-specific settings that override the base client configuration.
          </Typography>

          {Object.entries(config.environments).map(([envName, envConfig]) => (
            <Box key={envName} sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                {envName.toUpperCase()} Environment
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={envConfig.enabled ?? true}
                        onChange={(e) => updateConfig(['environments', envName, 'enabled'], e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Environment Enabled"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lambda Memory Size (MB)"
                    type="number"
                    value={envConfig.scaling?.lambda?.memorySize ?? 512}
                    onChange={(e) => updateConfig(['environments', envName, 'scaling', 'lambda', 'memorySize'], parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lambda Timeout (seconds)"
                    type="number"
                    value={envConfig.scaling?.lambda?.timeout ?? 60}
                    onChange={(e) => updateConfig(['environments', envName, 'scaling', 'lambda', 'timeout'], parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </Grid>
              </Grid>
              {envName !== 'prod' && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default ClientEditor;
