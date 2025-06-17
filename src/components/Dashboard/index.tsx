// src/components/Dashboard/index.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  AppShell,
  Group,
  Text,
  Container,
  Center,
  Stack,
  Paper,
  Title,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconSettings } from "@tabler/icons-react";
import ConfigForm from "@/components/configForm";
import { ConfigData } from "@/type/config";

interface DashboardProps {}

const Dashboard: React.FC<DashboardProps> = () => {
  const [
    configModalOpened,
    { open: openConfigModal, close: closeConfigModal },
  ] = useDisclosure();
  const [hasValidConfig, setHasValidConfig] = useState<boolean>(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);

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
  }, [checkConfigValidity]);

  useEffect(() => {
    // Auto-open config modal if no valid config exists
    if (!isCheckingConfig && !hasValidConfig) {
      openConfigModal();
    }
  }, [isCheckingConfig, hasValidConfig, openConfigModal]);

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
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg">
          <Center style={{ minHeight: 400 }}>
            <Paper
              p="xl"
              radius="md"
              shadow="sm"
              style={{ textAlign: "center", maxWidth: 600 }}
            >
              <Stack gap="md">
                <Title order={2}>Welcome to Echo Desktop</Title>

                {isCheckingConfig ? (
                  <Text c="dimmed">Checking configuration...</Text>
                ) : hasValidConfig ? (
                  <>
                    <Text c="green" fw={500}>
                      ✓ Bot configuration is ready
                    </Text>
                    <Text c="dimmed" size="sm">
                      Your Solana copy trading bot is configured and ready to
                      use. Use the menu to modify settings or view trading
                      activity.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text c="orange" fw={500}>
                      ⚠ Configuration Required
                    </Text>
                    <Text c="dimmed" size="sm">
                      Please complete the bot configuration to get started. The
                      configuration modal should open automatically.
                    </Text>
                    <Button
                      variant="filled"
                      leftSection={<IconSettings size={16} />}
                      onClick={openConfigModal}
                    >
                      Open Configuration
                    </Button>
                  </>
                )}
              </Stack>
            </Paper>
          </Center>
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
