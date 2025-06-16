// src/components/ConfigForm/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import "./style.css";
import {
  defaultSetupValues,
  SaveConfigResponse,
  ConfigData,
} from "../../type/config";

const ConfigForm: React.FC = () => {
  const [formData, setFormData] = useState<ConfigData>(defaultSetupValues);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      const config = await window.electronAPI.loadConfig();
      if (config) {
        setFormData(config);
        setFeedback({ type: "success", message: "Loaded current settings." });
      } else {
        setFormData(defaultSetupValues);
        setFeedback({
          type: "info",
          message: "No saved settings found, loaded defaults.",
        } as any);
      }
    } catch (error) {
      console.error("Error loading config:", error);
      setFormData(defaultSetupValues);
      setFeedback({
        type: "error",
        message: `Error loading settings: ${error as Error}.message`,
      });
    }
  }, []);

  useEffect(() => {
    loadSettings(); // Load settings on initial component mount
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    setFeedback(null);
    // Basic type coercion before sending to main (main process does authoritative validation)
    const dataToSend: ConfigData = {
      ...formData,
      copyTradeAmountSol: parseFloat(String(formData.copyTradeAmountSol)),
      slippagePercentage: parseInt(String(formData.slippagePercentage), 10),
      ...(formData.manageWithSltp && {
        takeProfitPercentage: parseInt(
          String(formData.takeProfitPercentage),
          10
        ),
        stopLossPercentage: parseInt(String(formData.stopLossPercentage), 10),
        priceCheckIntervalSeconds: parseInt(
          String(formData.priceCheckIntervalSeconds),
          10
        ),
      }),
    };

    console.log("dataToSend", dataToSend);

    try {
      const result: SaveConfigResponse = await window.electronAPI.saveConfig(
        dataToSend
      );
      if (result.success) {
        setFeedback({
          type: "success",
          message: result.message || "Settings saved successfully!",
        });
      } else {
        setFeedback({
          type: "error",
          message: result.error || "Failed to save settings.",
        });
      }
    } catch (error) {
      console.error("Error saving config:", error);
      setFeedback({
        type: "error",
        message: `Error saving settings: ${error as Error}.message`,
      });
    }
  };

  return (
    <div className="config-form-container">
      <h2>Bot Configuration</h2>

      <div className="form-group">
        <label htmlFor="rpcEndpointUrl">RPC Endpoint URL:</label>
        <input
          type="text"
          id="rpcEndpointUrl"
          name="rpcEndpointUrl"
          value={formData.rpcEndpointUrl}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="botWalletPrivateKey">Bot Wallet Private Key:</label>
        <input
          type="password"
          id="botWalletPrivateKey"
          name="botWalletPrivateKey"
          value={formData.botWalletPrivateKey}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="copyTradeAmountSol">Copy Trade Amount (SOL):</label>
        <input
          type="text"
          id="copyTradeAmountSol"
          name="copyTradeAmountSol"
          value={formData.copyTradeAmountSol}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="slippagePercentage">Slippage Percentage (%):</label>
        <input
          type="text"
          id="slippagePercentage"
          name="slippagePercentage"
          value={formData.slippagePercentage}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="monitoredWalletAddresses">
          Monitored Wallet Addresses (comma-separated):
        </label>
        <textarea
          id="monitoredWalletAddresses"
          name="monitoredWalletAddresses"
          value={formData.monitoredWalletAddresses}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="manageWithSltp">
          <input
            type="checkbox"
            id="manageWithSltp"
            name="manageWithSltp"
            checked={formData.manageWithSltp}
            onChange={handleInputChange}
          />
          Enable SL/TP Management
        </label>
      </div>

      {formData.manageWithSltp && (
        <div className="conditional-fields">
          <div className="form-group">
            <label htmlFor="takeProfitPercentage">
              Take Profit Percentage (%):
            </label>
            <input
              type="text"
              id="takeProfitPercentage"
              name="takeProfitPercentage"
              value={formData.takeProfitPercentage || ""}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="stopLossPercentage">
              Stop Loss Percentage (%):
            </label>
            <input
              type="text"
              id="stopLossPercentage"
              name="stopLossPercentage"
              value={formData.stopLossPercentage || ""}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="priceCheckIntervalSeconds">
              Price Check Interval (ms):
            </label>
            <input
              type="text"
              id="priceCheckIntervalSeconds"
              name="priceCheckIntervalSeconds"
              value={formData.priceCheckIntervalSeconds || ""}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}

      <div className="form-actions">
        <button onClick={loadSettings}>Load Current Settings</button>
        <button onClick={handleSaveSettings}>Save Settings</button>
      </div>

      {feedback && (
        <div className={`feedback-area ${feedback.type}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
};

export default ConfigForm;
