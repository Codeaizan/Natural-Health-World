// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// On Windows release builds, set the subsystem to "windows" so the OS does not
// open a black console terminal alongside the GUI window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Application entry point — Rust starts here
fn main() {
  app_lib::run(); // Delegate all Tauri setup logic to lib.rs::run()
}
