const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Expose protected methods that allow the renderer process to use
  // the ipcRenderer without exposing the entire object
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ["toMain"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = [
      "fromMain",
      "update-available",
      "update-downloaded",
      "update-error",
      "dgii:progress",
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  invoke: (channel, ...args) => {
    let validChannels = [
      "db:get-products",
      "db:add-product",
      "db:update-product",
      "db:delete-product",
      "db:get-clients",
      "db:add-client",
      "db:get-ncf-sequences",
      "db:update-ncf-sequence",
      "db:get-quotes",
      "db:convert-quote-to-invoice",
      // Time Clock
      "db:get-employees",
      "db:add-employee",
      "db:clock-action",
      "db:get-time-logs",
      "db:get-payroll-preview",
      // Recruitment
      "db:get-candidates",
      "db:add-candidate",
      "db:update-candidate-status",
      "db:hire-candidate",
      "db:delete-candidate",
      "db:open-folder",
      "db:save-setting",
      "db:get-setting",
      "email:send-invitation",
      "api:search-rnc",
      "db:sync-dgii",
      "db:get-dgii-status",
      "db:create-invoice",
      "db:login",
      "db:get-users",
      "db:add-user",
      "db:add-expense",
      "db:get-expenses",
      "db:add-expense",
      "db:get-expenses",
      "db:get-daily-stats",
      "db:get-active-shift",
      "db:open-shift",
      "db:close-shift",
      "db:add-cash-closing",
      "db:activate-node",
      "db:sync-all-cloud",
      "db:pull-cloud",
      "app:restart-install",
      "app:get-version",
      "app:get-hostname",
      "app:get-machine-id",
      "app:check-updates",
      "pdf:download",
      "app:toggle-fullscreen",
      // Inventario Avanzado: Familias, Variantes, SKUs
      "db:get-families",
      "db:add-family",
      "db:update-family",
      "db:delete-family",
      "db:get-variants",
      "db:add-variant",
      "db:update-variant",
      "db:delete-variant",
      "db:get-skus",
      "db:add-sku",
      "db:update-sku",
      "db:delete-sku",
      "db:adjust-sku-stock",
      "db:search-skus-global",
      "mail:request-link",
      "mail:get-link-status",
      "app:open-external",
      "db:print-quote",
      "db:email-quote",
      "db:download-quote-pdf",
      "db:delete-invoice",
      "db:get-invoice-items",
      "db:get-config",
      "db:save-config",
      "db:upload-logo",
      "cloud:push-all"
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  on: (channel, func) => {
    let validChannels = [
      "update-available",
      "update-downloaded",
      "download-progress",
      "cloud:sync-refresh"
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  onCloudSyncRefresh: (callback) => {
    const channel = "cloud:sync-refresh";
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
