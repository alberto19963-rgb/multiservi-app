export const system = {
  onUpdateAvailable: (callback) =>
    window.electronAPI.receive("update-available", callback),
  onUpdateDownloaded: (callback) =>
    window.electronAPI.receive("update-downloaded", callback),
  restartAndInstall: () => window.electronAPI.invoke("app:restart-install"),
  getVersion: () => window.electronAPI.invoke("app:get-version"),
  getHostname: () => window.electronAPI.invoke("app:get-hostname"),
  getMachineId: () => window.electronAPI.invoke("app:get-machine-id"),
  toggleFullscreen: () => window.electronAPI.invoke("app:toggle-fullscreen"),
};

export const db = {
  getProducts: (query) => window.electronAPI.invoke("db:get-products", query),
  addProduct: (product) => window.electronAPI.invoke("db:add-product", product),
  updateProduct: (product) => window.electronAPI.invoke("db:update-product", product),
  deleteProduct: (id) => window.electronAPI.invoke("db:delete-product", id),
  getClients: () => window.electronAPI.invoke("db:get-clients"),
  addClient: (client) => window.electronAPI.invoke("db:add-client", client),
  getNcfSequences: () => window.electronAPI.invoke("db:get-ncf-sequences"),
  searchRNC: (rnc) => window.electronAPI.invoke("api:search-rnc", rnc),
  syncDGII: () => window.electronAPI.invoke("db:sync-dgii"),
  getDGIIStatus: () => window.electronAPI.invoke("db:get-dgii-status"),
  onDGIIProgress: (callback) => window.electronAPI.receive("dgii:progress", callback),
  updateNcfSequence: (data) =>
    window.electronAPI.invoke("db:update-ncf-sequence", data),
  createInvoice: (data) => window.electronAPI.invoke("db:create-invoice", data),
  createQuote: (data) =>
    window.electronAPI.invoke("db:create-invoice", { ...data, isQuote: true }),
  getQuotes: () => window.electronAPI.invoke("db:get-quotes"),
  convertQuoteToInvoice: (id) =>
    window.electronAPI.invoke("db:convert-quote-to-invoice", id),
  login: (creds) => window.electronAPI.invoke("db:login", creds),
  getUsers: () => window.electronAPI.invoke("db:get-users"),
  addUser: (user) => window.electronAPI.invoke("db:add-user", user),

  // Finance
  addExpense: (data) => window.electronAPI.invoke("db:add-expense", data),
  getExpenses: (filter) => window.electronAPI.invoke("db:get-expenses", filter),
  getDailyStats: () => window.electronAPI.invoke("db:get-daily-stats"),
  getLowStockCount: () => window.electronAPI.invoke("db:get-low-stock-count"),

  // Time Clock / HR
  getEmployees: () => window.electronAPI.invoke("db:get-employees"),
  addEmployee: (data) => window.electronAPI.invoke("db:add-employee", data),
  clockAction: (identifier, type) =>
    window.electronAPI.invoke("db:clock-action", { identifier, type }),
  getTimeLogs: () => window.electronAPI.invoke("db:get-time-logs"),
  getPayrollPreview: () => window.electronAPI.invoke("db:get-payroll-preview"),

  // Recruitment
  getCandidates: () => window.electronAPI.invoke("db:get-candidates"),
  addCandidate: (data) => window.electronAPI.invoke("db:add-candidate", data),
  deleteCandidate: (id) => window.electronAPI.invoke("db:delete-candidate", id),
  updateCandidateStatus: (id, status, notes) =>
    window.electronAPI.invoke("db:update-candidate-status", {
      id,
      status,
      notes,
    }),
  hireCandidate: (data) => window.electronAPI.invoke("db:hire-candidate", data),
  openFolder: (path) => window.electronAPI.invoke("db:open-folder", path),
  saveSetting: (key, value) =>
    window.electronAPI.invoke("db:save-setting", key, value),
  getSetting: (key) => window.electronAPI.invoke("db:get-setting", key),
  sendInvitation: (data) =>
    window.electronAPI.invoke("email:send-invitation", data),

  addCashClosing: (data) =>
    window.electronAPI.invoke("db:add-cash-closing", data),

  downloadPDF: (data) => window.electronAPI.invoke("pdf:download", data),

  // Updates
  onUpdateAvailable: (callback) =>
    window.electronAPI.on("update-available", callback),
  onUpdateDownloaded: (callback) =>
    window.electronAPI.on("update-downloaded", callback),
  restartInstall: () => window.electronAPI.invoke("app:restart-install"),

  // ── Inventario Avanzado: Familias, Variantes, SKUs ──────────────────────
  getFamilies:      ()     => window.electronAPI.invoke("db:get-families"),
  addFamily:        (data) => window.electronAPI.invoke("db:add-family", data),
  updateFamily:     (data) => window.electronAPI.invoke("db:update-family", data),
  deleteFamily:     (id)   => window.electronAPI.invoke("db:delete-family", id),

  getVariants:      (familyId) => window.electronAPI.invoke("db:get-variants", familyId),
  addVariant:       (data)     => window.electronAPI.invoke("db:add-variant", data),
  updateVariant:    (data)     => window.electronAPI.invoke("db:update-variant", data),
  deleteVariant:    (id)       => window.electronAPI.invoke("db:delete-variant", id),

  getSkus:          (variantId) => window.electronAPI.invoke("db:get-skus", variantId),
  addSku:           (data)      => window.electronAPI.invoke("db:add-sku", data),
  updateSku:        (data)      => window.electronAPI.invoke("db:update-sku", data),
  deleteSku:        (id)        => window.electronAPI.invoke("db:delete-sku", id),
  adjustSkuStock:   (data)      => window.electronAPI.invoke("db:adjust-sku-stock", data),
  searchSkusGlobal: (query)     => window.electronAPI.invoke("db:search-skus-global", query),

  // Shifts
  getActiveShift:   (userId) => window.electronAPI.invoke("db:get-active-shift", userId),
  openShift:         (data)   => window.electronAPI.invoke("db:open-shift", data),
  closeShift:        (data)   => window.electronAPI.invoke("db:close-shift", data),
  
  // Mail Engine (External)
  requestMailLink:   (data) => window.electronAPI.invoke("mail:request-link", data),
  getMailLinkStatus: (email) => window.electronAPI.invoke("mail:get-link-status", email),
};
