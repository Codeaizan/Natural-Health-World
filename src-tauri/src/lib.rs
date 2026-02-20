use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "Create initial tables",
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
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:nhw_data.db", migrations)
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
