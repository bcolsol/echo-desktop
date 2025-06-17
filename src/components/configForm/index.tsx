// src/components/ConfigForm/index.tsx
import React, { useEffect, useCallback } from "react";
import {
  TextInput,
  NumberInput,
  Textarea,
  Checkbox,
  Button,
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Fieldset,
  LoadingOverlay,
  Text,
  Modal,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  defaultSetupValues,
  SaveConfigResponse,
  ConfigData,
} from "../../type/config";

interface LoadingState {
  loading: boolean;
  saving: boolean;
}

interface ConfigFormProps {
  opened: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ opened, onClose, onConfigSaved }) => {
  const [loadingState, setLoadingState] = React.useState<LoadingState>({
    loading: false,
    saving: false,
  });

  const form = useForm<ConfigData>({
    initialValues: defaultSetupValues,
    validate: {
      rpcEndpointUrl: (value: string) => {
        if (!value) return 'RPC endpoint URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL (e.g., https://api.mainnet-beta.solana.com)';
        }
      },
      botWalletPrivateKey: (value: string) => {
        if (!value) return 'Bot wallet private key is required';
        if (value.length < 32) return 'Private key appears to be too short';
        return null;
      },
      copyTradeAmountSol: (value: number) => {
        if (isNaN(value)) return 'Amount must be a valid number';
        if (value <= 0) return 'Amount must be greater than 0';
        if (value > 1000) return 'Amount seems unusually high (>1000 SOL)';
        return null;
      },
      slippagePercentage: (value: number) => {
        if (isNaN(value)) return 'Slippage must be a valid number';
        if (value < 0 || value > 100) return 'Slippage must be between 0-100%';
        return null;
      },
      monitoredWalletAddresses: (value: string) => {
        if (!value) return 'At least one wallet address is required';
        const addresses = value.split(',').map(addr => addr.trim());
        const invalidAddresses = addresses.filter(addr => {
          return !addr || addr.length < 32 || addr.length > 44;
        });
        if (invalidAddresses.length > 0) {
          return 'All wallet addresses must be 32-44 characters long';
        }
        return null;
      },
      takeProfitPercentage: (value: number | undefined, values: ConfigData) => {
        if (!values.manageWithSltp) return null;
        if (value === undefined || isNaN(value)) return 'Percentage must be a valid number';
        if (value <= 0 || value > 1000) return 'Percentage must be between 1-1000%';
        return null;
      },
      stopLossPercentage: (value: number | undefined, values: ConfigData) => {
        if (!values.manageWithSltp) return null;
        if (value === undefined || isNaN(value)) return 'Percentage must be a valid number';
        if (value <= 0 || value > 1000) return 'Percentage must be between 1-1000%';
        return null;
      },
      priceCheckIntervalSeconds: (value: number | undefined, values: ConfigData) => {
        if (!values.manageWithSltp) return null;
        if (value === undefined || isNaN(value)) return 'Interval must be a valid number';
        if (value < 1) return 'Interval must be at least 1 second';
        if (value > 3600) return 'Interval should not exceed 1 hour (3600s)';
        return null;
      },
    },
  });


  const loadSettings = useCallback(async (showNotifications: boolean = true): Promise<void> => {
    setLoadingState(prev => ({ ...prev, loading: true }));
    
    try {
      const config: ConfigData | null = await (window as any).electronAPI.loadConfig();
      if (config) {
        form.setValues(config);
        form.clearErrors();
        if (showNotifications) {
          notifications.show({
            title: 'Success',
            message: 'Settings loaded successfully',
            color: 'green',
          });
        }
      } else {
        form.setValues(defaultSetupValues);
        form.clearErrors();
        if (showNotifications) {
          notifications.show({
            title: 'Info',
            message: 'No saved settings found. Using default values.',
            color: 'blue',
          });
        }
      }
    } catch (error: unknown) {
      console.error("Error loading config:", error);
      form.setValues(defaultSetupValues);
      form.clearErrors();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (showNotifications) {
        notifications.show({
          title: 'Error',
          message: `Failed to load settings: ${errorMessage}. Please check your configuration file.`,
          color: 'red',
        });
      }
    } finally {
      setLoadingState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadSettings(false); // Load settings on initial component mount without notifications
  }, []);


  const handleSaveSettings = form.onSubmit(async (values: ConfigData): Promise<void> => {
    setLoadingState(prev => ({ ...prev, saving: true }));
    
    try {
      const dataToSend: ConfigData = {
        ...values,
        copyTradeAmountSol: Number(values.copyTradeAmountSol),
        slippagePercentage: Number(values.slippagePercentage),
        ...(values.manageWithSltp && {
          takeProfitPercentage: values.takeProfitPercentage ? Number(values.takeProfitPercentage) : undefined,
          stopLossPercentage: values.stopLossPercentage ? Number(values.stopLossPercentage) : undefined,
          priceCheckIntervalSeconds: values.priceCheckIntervalSeconds ? Number(values.priceCheckIntervalSeconds) : undefined,
        }),
      };

      const result: SaveConfigResponse = await (window as any).electronAPI.saveConfig(
        dataToSend
      );
      
      if (result.success) {
        notifications.show({
          title: 'Success',
          message: result.message || 'Settings saved successfully! Your bot configuration is now active.',
          color: 'green',
        });
        // Call the callback to notify parent component
        if (onConfigSaved) {
          onConfigSaved();
        }
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to save settings. Please check your configuration and try again.',
          color: 'red',
        });
      }
    } catch (error: unknown) {
      console.error("Error saving config:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: `Failed to save settings: ${errorMessage}. Please check your input values and try again.`,
        color: 'red',
      });
    } finally {
      setLoadingState(prev => ({ ...prev, saving: false }));
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Bot Configuration"
      size="lg"
      centered
      closeOnClickOutside={false}
      withCloseButton={true}
    >
      <Container size="md" p={0}>
        <Paper shadow="none" p="md" radius="md" style={{ position: 'relative' }}>
          <LoadingOverlay visible={loadingState.loading} overlayProps={{ radius: "sm", blur: 2 }} />
        
        <form onSubmit={handleSaveSettings}>
          <Stack gap="md">
            <TextInput
              label="RPC Endpoint URL"
              placeholder="https://api.mainnet-beta.solana.com"
              description="The Solana RPC endpoint URL for blockchain communication"
              required
              disabled={loadingState.loading || loadingState.saving}
              {...form.getInputProps('rpcEndpointUrl')}
            />

            <TextInput
              label="Bot Wallet Private Key"
              type="password"
              placeholder="Enter your bot's private key"
              description="Your bot's private key (kept secure and never shared)"
              required
              disabled={loadingState.loading || loadingState.saving}
              autoComplete="off"
              {...form.getInputProps('botWalletPrivateKey')}
            />

            <NumberInput
              label="Copy Trade Amount (SOL)"
              placeholder="0.1"
              description="Amount of SOL to use for each copy trade"
              required
              min={0.001}
              max={1000}
              step={0.001}
              decimalScale={3}
              disabled={loadingState.loading || loadingState.saving}
              {...form.getInputProps('copyTradeAmountSol')}
            />

            <NumberInput
              label="Slippage Percentage (%)"
              placeholder="30"
              description="Maximum price slippage tolerance (typically 1-50%)"
              required
              min={0}
              max={100}
              disabled={loadingState.loading || loadingState.saving}
              {...form.getInputProps('slippagePercentage')}
            />

            <Textarea
              label="Monitored Wallet Addresses"
              placeholder="Enter wallet addresses separated by commas"
              description="Enter wallet addresses to monitor, separated by commas (e.g., 1abc..., 2def...)"
              required
              rows={3}
              disabled={loadingState.loading || loadingState.saving}
              {...form.getInputProps('monitoredWalletAddresses')}
            />

            <Checkbox
              label="Enable Stop Loss / Take Profit Management"
              description="Automatically manage positions with stop loss and take profit orders"
              disabled={loadingState.loading || loadingState.saving}
              {...form.getInputProps('manageWithSltp', { type: 'checkbox' })}
            />

            {form.values.manageWithSltp && (
              <Fieldset legend="Stop Loss / Take Profit Settings">
                <Stack gap="md">
                  <NumberInput
                    label="Take Profit Percentage (%)"
                    placeholder="20"
                    description="Profit target percentage (e.g., 20 for 20% profit)"
                    min={1}
                    max={1000}
                    disabled={loadingState.loading || loadingState.saving}
                    {...form.getInputProps('takeProfitPercentage')}
                  />
                  
                  <NumberInput
                    label="Stop Loss Percentage (%)"
                    placeholder="10"
                    description="Maximum loss percentage (e.g., 10 for 10% loss limit)"
                    min={1}
                    max={100}
                    disabled={loadingState.loading || loadingState.saving}
                    {...form.getInputProps('stopLossPercentage')}
                  />
                  
                  <NumberInput
                    label="Price Check Interval (seconds)"
                    placeholder="5"
                    description="How often to check prices in seconds (1-3600)"
                    min={1}
                    max={3600}
                    disabled={loadingState.loading || loadingState.saving}
                    {...form.getInputProps('priceCheckIntervalSeconds')}
                  />
                </Stack>
              </Fieldset>
            )}

            <Group justify="flex-end" mt="lg">
              <Button 
                variant="default"
                onClick={() => loadSettings(true)}
                loading={loadingState.loading}
                disabled={loadingState.saving}
              >
                Load Current Settings
              </Button>
              
              <Button 
                type="submit"
                loading={loadingState.saving}
                disabled={loadingState.loading}
              >
                Save Settings
              </Button>
            </Group>
            
            <Stack gap="xs" mt="sm">
              <Text size="sm" c="dimmed">
                Load: Load previously saved configuration from disk
              </Text>
              <Text size="sm" c="dimmed">
                Save: Save current configuration to disk and activate bot settings
              </Text>
            </Stack>
          </Stack>
        </form>
        </Paper>
      </Container>
    </Modal>
  );
};

export default ConfigForm;
