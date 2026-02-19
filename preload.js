const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  savePdfBlob: (filename, pdfBlob) =>
    ipcRenderer.invoke('save-pdf-blob', { filename, pdfBlob }),
  getInvoicesPath: () =>
    ipcRenderer.invoke('get-invoices-path'),
  saveBillPdf: (filename, htmlContent) =>
    ipcRenderer.invoke('save-bill-pdf', { filename, htmlContent })
});
