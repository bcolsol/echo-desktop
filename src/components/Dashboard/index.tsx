// src/components/Dashboard/index.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  AppShell,
  Group,
  Text,
  Container,
  Stack,
  Paper,
  Title,
  Button,
  Grid,
  Badge,
  ScrollArea,
  Alert,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconSettings, IconPlayerPlay, IconPlayerStop, IconActivity } from "@tabler/icons-react";
import ConfigForm from "@/components/configForm";
import { ConfigData } from "@/type/config";
import { WalletLogEvent, WalletMonitoringError, WalletMonitoringStatus } from "@/type/wallet";

interface DashboardProps {}

const Dashboard: React.FC<DashboardProps> = () => {
  const [
    configModalOpened,
    { open: openConfigModal, close: closeConfigModal },
  ] = useDisclosure();
  const [hasValidConfig, setHasValidConfig] = useState<boolean>(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);
  const [monitoringStatus, setMonitoringStatus] = useState<WalletMonitoringStatus | null>(null);
  const [walletEvents, setWalletEvents] = useState<WalletLogEvent[]>([]);
  const [isStartingMonitoring, setIsStartingMonitoring] = useState<boolean>(false);
  const [isStoppingMonitoring, setIsStoppingMonitoring] = useState<boolean>(false);

  const updateMonitoringStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await window.electronAPI.getWalletMonitoringStatus();
      setMonitoringStatus(status);
    } catch (error) {
      console.error("Failed to get monitoring status:", error);
    }
  }, []);

  const checkConfigValidity = useCallback(async (): Promise<void> => {
    setIsCheckingConfig(true);
    try {
      const config: ConfigData | null = await (
        window as any
      ).electronAPI.loadConfig();

      if (!config) {
        setHasValidConfig(false);
        return;
      }

      // Check if required fields are present and not empty
      const requiredFields: (keyof ConfigData)[] = [
        "rpcEndpointUrl",
        "botWalletPrivateKey",
        "monitoredWalletAddresses",
      ];

      const isValid = requiredFields.every((field) => {
        const value = config[field];
        return value && typeof value === "string" && value.trim().length > 0;
      });

      setHasValidConfig(isValid);
    } catch (error) {
      console.error("Error checking config validity:", error);
      setHasValidConfig(false);
    } finally {
      setIsCheckingConfig(false);
    }
  }, []);

  useEffect(() => {
    checkConfigValidity();
    
    // Set up wallet event listeners
    const removeWalletEventListener = window.electronAPI.onWalletLogEvent((event: WalletLogEvent) => {
      setWalletEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
      notifications.show({
        title: "Wallet Activity",
        message: `Transaction detected on ${event.walletAddress.slice(0, 8)}...`,
        color: "blue",
        autoClose: 3000,
      });
    });

    const removeWalletErrorListener = window.electronAPI.onWalletError((error: WalletMonitoringError) => {
      notifications.show({
        title: "Monitoring Error",
        message: error.message,
        color: "red",
        autoClose: 5000,
      });
    });

    // Clean up listeners on unmount
    return () => {
      removeWalletEventListener();
      removeWalletErrorListener();
    };
  }, [checkConfigValidity]);

  useEffect(() => {
    // Auto-open config modal if no valid config exists
    if (!isCheckingConfig && !hasValidConfig) {
      openConfigModal();
    }
    
    // Update monitoring status when config validity changes
    if (hasValidConfig) {
      updateMonitoringStatus();
    }
  }, [isCheckingConfig, hasValidConfig, openConfigModal, updateMonitoringStatus]);

  const handleStartMonitoring = useCallback(async (): Promise<void> => {
    if (!hasValidConfig) {
      notifications.show({
        title: "Configuration Required",
        message: "Please configure the bot before starting monitoring.",
        color: "orange",
      });
      return;
    }

    try {
      setIsStartingMonitoring(true);
      const config = await window.electronAPI.loadConfig();
      if (!config) {
        throw new Error("Failed to load configuration");
      }

      const result = await window.electronAPI.startWalletMonitoring({
        rpcEndpointUrl: config.rpcEndpointUrl,
        monitoredWalletAddresses: config.monitoredWalletAddresses,
      });

      if (result.success) {
        notifications.show({
          title: "Monitoring Started",
          message: "Wallet monitoring is now active",
          color: "green",
        });
        await updateMonitoringStatus();
      } else {
        throw new Error(result.error || "Failed to start monitoring");
      }
    } catch (error) {
      notifications.show({
        title: "Error",
        message: `Failed to start monitoring: ${(error as Error).message}`,
        color: "red",
      });
    } finally {
      setIsStartingMonitoring(false);
    }
  }, [hasValidConfig, updateMonitoringStatus]);

  const handleStopMonitoring = useCallback(async (): Promise<void> => {
    try {
      setIsStoppingMonitoring(true);
      const result = await window.electronAPI.stopWalletMonitoring();
      
      if (result.success) {
        notifications.show({
          title: "Monitoring Stopped",
          message: "Wallet monitoring has been stopped",
          color: "orange",
        });
        await updateMonitoringStatus();
      } else {
        throw new Error(result.error || "Failed to stop monitoring");
      }
    } catch (error) {
      notifications.show({
        title: "Error",
        message: `Failed to stop monitoring: ${(error as Error).message}`,
        color: "red",
      });
    } finally {
      setIsStoppingMonitoring(false);
    }
  }, [updateMonitoringStatus]);

  const handleConfigSaved = useCallback(() => {
    closeConfigModal();
    checkConfigValidity(); // Recheck config after saving
    notifications.show({
      title: "Configuration Updated",
      message: "Your bot configuration has been updated successfully.",
      color: "green",
    });
  }, [closeConfigModal, checkConfigValidity]);

  const handleConfigModalClose = useCallback(() => {
    // Only allow closing if we have a valid config
    if (hasValidConfig) {
      closeConfigModal();
    } else {
      notifications.show({
        title: "Configuration Required",
        message: "Please complete the configuration before continuing.",
        color: "orange",
      });
    }
  }, [hasValidConfig, closeConfigModal]);

  console.log(configModalOpened);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: "sm",
        collapsed: { mobile: false, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Text size="lg" fw={600}>
            Echo Desktop - Solana Copy Trading Bot
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack>
          <Text fw={500} size="sm" c="dimmed">
            Navigation
          </Text>
          <Button
            variant="light"
            leftSection={<IconSettings size={16} />}
            onClick={openConfigModal}
            fullWidth
          >
            Configuration
          </Button>
          
          <Text fw={500} size="sm" c="dimmed" mt="md">
            Monitoring
          </Text>
          
          {hasValidConfig && (
            <>
              {!monitoringStatus?.isRunning ? (
                <Button
                  variant="filled"
                  color="green"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={handleStartMonitoring}
                  loading={isStartingMonitoring}
                  fullWidth
                >
                  Start Monitoring
                </Button>
              ) : (
                <Button
                  variant="filled"
                  color="red"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={handleStopMonitoring}
                  loading={isStoppingMonitoring}
                  fullWidth
                >
                  Stop Monitoring
                </Button>
              )}
            </>
          )}
          
          {monitoringStatus && (
            <Paper p="sm" radius="md" bg="gray.0">
              <Stack gap="xs">
                <Flex justify="space-between" align="center">
                  <Text size="xs" fw={500}>Status</Text>
                  <Badge 
                    color={monitoringStatus.isRunning ? "green" : "gray"} 
                    size="xs"
                  >
                    {monitoringStatus.isRunning ? "Running" : "Stopped"}
                  </Badge>
                </Flex>
                <Text size="xs" c="dimmed">
                  Wallets: {monitoringStatus.monitoredWallets.length}
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" p="md">
          <Stack gap="md">
            {/* Status Section */}
            {isCheckingConfig ? (
              <Alert color="blue">
                <Text>Checking configuration...</Text>
              </Alert>
            ) : !hasValidConfig ? (
              <Alert color="orange" title="Configuration Required">
                <Text>Please complete the bot configuration to get started.</Text>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconSettings size={16} />}
                  onClick={openConfigModal}
                  mt="sm"
                >
                  Open Configuration
                </Button>
              </Alert>
            ) : null}

            {/* Wallet Events Section */}
            <Grid>
              <Grid.Col span={12}>
                <Paper p="md" radius="md" shadow="sm">
                  <Stack gap="md">
                    <Flex justify="space-between" align="center">
                      <Group>
                        <IconActivity size={20} />
                        <Title order={3}>Wallet Activity</Title>
                      </Group>
                      <Badge 
                        color={walletEvents.length > 0 ? "green" : "gray"}
                        variant="light"
                      >
                        {walletEvents.length} events
                      </Badge>
                    </Flex>

                    {walletEvents.length === 0 ? (
                      <Text c="dimmed" ta="center" py="xl">
                        {hasValidConfig && monitoringStatus?.isRunning 
                          ? "Monitoring for wallet activity..." 
                          : "No wallet activity yet. Start monitoring to see transactions."}
                      </Text>
                    ) : (
                      <ScrollArea h={400}>
                        <Stack gap="xs">
                          {walletEvents.map((event, index) => (
                            <Paper key={`${event.signature}-${index}`} p="sm" radius="sm" bg="gray.0">
                              <Group justify="space-between" align="flex-start">
                                <Stack gap={4} style={{ flex: 1 }}>
                                  <Group gap="xs">
                                    <Text size="sm" fw={500}>
                                      {event.walletAddress.slice(0, 8)}...{event.walletAddress.slice(-8)}
                                    </Text>
                                    <Badge 
                                      size="xs" 
                                      color={event.err ? "red" : "green"}
                                      variant="light"
                                    >
                                      {event.err ? "Failed" : "Success"}
                                    </Badge>
                                  </Group>
                                  <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                    {event.signature}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Slot: {event.slot} • {new Date(event.timestamp).toLocaleTimeString()}
                                  </Text>
                                  {event.logs.length > 0 && (
                                    <Text size="xs" c="dimmed">
                                      {event.logs.length} log entries
                                    </Text>
                                  )}
                                </Stack>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </ScrollArea>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Stack>
        </Container>
      </AppShell.Main>

      <ConfigForm
        opened={configModalOpened}
        onClose={handleConfigModalClose}
        onConfigSaved={handleConfigSaved}
      />
    </AppShell>
  );
};

export default Dashboard;
