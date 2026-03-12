// Import the SQL plugin's Migration and MigrationKind types.
// Migration defines a versioned SQL script; MigrationKind::Up means it runs during forward migrations.
use tauri_plugin_sql::{Migration, MigrationKind};

// On mobile targets this attribute marks the function as the mobile entry point.
// On desktop targets the macro expands to nothing, so pub fn run() is the normal Rust public function.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Build the list of database migrations to apply when the app first starts (or when upgrading).
  // Tauri's SQL plugin runs these automatically in version order before any SQL queries are made.
  let migrations = vec![
    Migration {
      version: 1,                              // Version 1 — the very first schema; run once on a fresh install
      description: "Create initial tables",   // Human-readable label shown in migration logs
      sql: r#"
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT '',
          hsn_code TEXT NOT NULL DEFAULT '',
          unit TEXT NOT NULL DEFAULT 'Nos',
          package_size TEXT,
          batch_number TEXT,
          expiry_date TEXT,
          mrp REAL NOT NULL DEFAULT 0,
          discount_percent REAL NOT NULL DEFAULT 0,
          selling_price REAL NOT NULL DEFAULT 0,
          purchase_price REAL NOT NULL DEFAULT 0,
          gst_rate REAL NOT NULL DEFAULT 0,
          current_stock REAL NOT NULL DEFAULT 0,
          min_stock_level REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          email TEXT,
          address TEXT,
          gstin TEXT
        );

        CREATE TABLE IF NOT EXISTS bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT NOT NULL,
          date TEXT NOT NULL,
          customer_id INTEGER NOT NULL,
          customer_name TEXT NOT NULL DEFAULT '',
          customer_phone TEXT NOT NULL DEFAULT '',
          customer_address TEXT,
          customer_gstin TEXT,
          sales_person_id INTEGER NOT NULL DEFAULT 0,
          sales_person_name TEXT NOT NULL DEFAULT '',
          is_gst_bill INTEGER NOT NULL DEFAULT 1,
          sub_total REAL NOT NULL DEFAULT 0,
          taxable_amount REAL NOT NULL DEFAULT 0,
          cgst_amount REAL NOT NULL DEFAULT 0,
          sgst_amount REAL NOT NULL DEFAULT 0,
          igst_amount REAL NOT NULL DEFAULT 0,
          total_tax REAL NOT NULL DEFAULT 0,
          round_off REAL NOT NULL DEFAULT 0,
          grand_total REAL NOT NULL DEFAULT 0,
          items TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS sales_persons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS stock_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL DEFAULT '',
          change_amount REAL NOT NULL DEFAULT 0,
          reason TEXT NOT NULL DEFAULT '',
          reference_id TEXT
        );

        CREATE TABLE IF NOT EXISTS backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'auto',
          size INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          last_login TEXT
        );
      "#,
      kind: MigrationKind::Up, // This script runs on the forward (install/upgrade) path
    },
  ];

  // Build and configure the Tauri application, register all plugins, then start the event loop
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())  // Register the file/folder picker and message dialog plugin
    .plugin(tauri_plugin_fs::init())      // Register the filesystem read/write plugin (copy, mkdir, exists, etc.)
    .plugin(
      // Register the SQLite plugin; supply the migrations so the schema is created on first launch
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:nhw_data.db", migrations) // Bind migrations to the NHW database file
        .build(), // Finalise the sql plugin configuration
    )
    .setup(|app| {
      // In debug builds only, register the log plugin at INFO level so dev console shows app logs
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info) // Log INFO and above (Info, Warn, Error) to the console
            .build(), // Finalise the log plugin configuration
        )?; // Propagate any plugin init error using Tauri's Result chain
      }
      Ok(()) // Signal successful setup to Tauri
    })
    .run(tauri::generate_context!())    // Load tauri.conf.json and start the application window
    .expect("error while running tauri application"); // Panic with a clear message if the app fails to start
}
