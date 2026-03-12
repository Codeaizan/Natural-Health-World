// Tauri build script — executed by Cargo before compiling the main crate.
// Required boilerplate: generates platform-specific glue code (icons, manifests,
// Windows resource files, etc.) that Tauri needs at compile time.
fn main() {
  tauri_build::build() // Call the Tauri build helper — must not be removed
}
