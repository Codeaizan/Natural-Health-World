// Dummy signing script - does nothing, just satisfies electron-builder
// Export an async function required by electron-builder for code signing
module.exports = async (configuration) => {
  // Log message indicating signing is being skipped (this is a dummy script)
  console.log("Skipping code signing (dummy signer)");
};
