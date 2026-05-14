import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ClientConfig {
  client: {
    name: string;
    displayName: string;
    description?: string;
    domains: {
      primary: string;
      www?: string;
      dev?: string;
      staging?: string;
      api?: string;
      admin?: string;
      additional?: string[];
    };
    email: {
      noreply: string;
      support?: string;
      admin?: string;
      notifications?: string;
      fromName?: string;
    };
    aws: {
      profile: string;
      region: string;
      accountId?: string;
      kmsKeyId?: string;
    };
    branding?: {
      primaryColor?: string;
      secondaryColor?: string;
      logo?: {
        url?: string;
        width?: number;
        height?: number;
      };
      favicon?: string;
    };
    integrations?: {
      g4h?: {
        origin?: string;
        appVersion?: string;
        platform?: string;
        deviceUuid?: string;
      };
      analytics?: {
        googleAnalytics?: string;
        mixpanel?: string;
      };
      payment?: {
        stripe?: {
          publishableKey?: string;
        };
      };
    };
    features?: {
      checkin?: {
        enabled?: boolean;
        deadlineHours?: number;
        qrCodeEnabled?: boolean;
        documentUpload?: {
          enabled?: boolean;
          maxSizeMB?: number;
          allowedTypes?: string[];
        };
      };
      reservations?: {
        syncEnabled?: boolean;
        syncIntervalMinutes?: number;
      };
      listings?: {
        syncEnabled?: boolean;
        publicListings?: boolean;
      };
    };
  };
  environments: {
    [key: string]: {
      enabled?: boolean;
      aws?: {
        profile?: string;
        region?: string;
        accountId?: string;
      };
      domains?: {
        primary?: string;
        api?: string;
      };
      features?: any;
      scaling?: {
        lambda?: {
          memorySize?: number;
          timeout?: number;
        };
        dynamodb?: {
          billingMode?: string;
        };
      };
    };
  };
}

interface ConfigContextType {
  clients: string[];
  currentClient: string | null;
  currentConfig: ClientConfig | null;
  loading: boolean;
  error: string | null;
  loadClients: () => Promise<void>;
  loadClient: (clientName: string) => Promise<void>;
  saveClient: (clientName: string, config: ClientConfig) => Promise<void>;
  createClient: (clientName: string) => Promise<void>;
  deleteClient: (clientName: string) => Promise<void>;
  validateConfig: (config: ClientConfig) => Promise<boolean>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [clients, setClients] = useState<string[]>([]);
  const [currentClient, setCurrentClient] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';

  const handleError = (error: any, operation: string) => {
    console.error(`Error during ${operation}:`, error);
    setError(`Failed to ${operation}: ${error.message || 'Unknown error'}`);
  };

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/clients`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      handleError(error, 'load clients');
    } finally {
      setLoading(false);
    }
  };

  const loadClient = async (clientName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/clients/${clientName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const config = await response.json();
      setCurrentClient(clientName);
      setCurrentConfig(config);
    } catch (error) {
      handleError(error, `load client ${clientName}`);
    } finally {
      setLoading(false);
    }
  };

  const saveClient = async (clientName: string, config: ClientConfig) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/clients/${clientName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      setCurrentConfig(config);
      await loadClients(); // Refresh client list
    } catch (error) {
      handleError(error, `save client ${clientName}`);
      throw error; // Re-throw to allow component to handle
    } finally {
      setLoading(false);
    }
  };

  const createClient = async (clientName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/clients/${clientName}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const config = await response.json();
      setCurrentClient(clientName);
      setCurrentConfig(config);
      await loadClients(); // Refresh client list
    } catch (error) {
      handleError(error, `create client ${clientName}`);
      throw error; // Re-throw to allow component to handle
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (clientName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/clients/${clientName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (currentClient === clientName) {
        setCurrentClient(null);
        setCurrentConfig(null);
      }
      await loadClients(); // Refresh client list
    } catch (error) {
      handleError(error, `delete client ${clientName}`);
      throw error; // Re-throw to allow component to handle
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = async (config: ClientConfig): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Validation failed');
      }
      
      return true;
    } catch (error) {
      handleError(error, 'validate configuration');
      return false;
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const value: ConfigContextType = {
    clients,
    currentClient,
    currentConfig,
    loading,
    error,
    loadClients,
    loadClient,
    saveClient,
    createClient,
    deleteClient,
    validateConfig,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
