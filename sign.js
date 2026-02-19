// Dummy signing script - does nothing, just satisfies electron-builder
module.exports = async (configuration) => {
  console.log("Skipping code signing (dummy signer)");
};
