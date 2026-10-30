import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "database.db")
  : path.join(process.cwd(), "database.db");

function createHealthyDb(targetPath: string): Database.Database {
  const removeDbFiles = () => {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const f = `${targetPath}${suffix}`;
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (err) {
          console.error(`Failed to delete corrupted db file ${f}:`, err);
        }
      }
    }
  };

  try {
    const instance = new Database(targetPath);
    const check = instance.pragma("integrity_check", { simple: true });
    if (check !== "ok") {
      instance.close();
      removeDbFiles();
      return new Database(targetPath);
    }
    return instance;
  } catch (err) {
    console.warn("SQLite database corrupt or unreadable, recreating clean database:", err);
    removeDbFiles();
    return new Database(targetPath);
  }
}

const db = createHealthyDb(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      machine_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL -- 'kabinet' or 'table'
    );

    CREATE TABLE IF NOT EXISTS active_sessions (
      table_id INTEGER PRIMARY KEY,
      start_time INTEGER,
      products_json TEXT DEFAULT '[]',
      is_already_paid INTEGER DEFAULT 0,
      billing_mode TEXT DEFAULT 'adi',
      deposit_amount REAL DEFAULT 0,
      guest_note TEXT DEFAULT '',
      reminder_enabled INTEGER DEFAULT 0,
      reminder_minutes INTEGER DEFAULT 0,
      reminder_end_time INTEGER DEFAULT 0,
      reminder_notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      original_quantity INTEGER DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      is_stockless INTEGER DEFAULT 0,
      price REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      inventory_id INTEGER,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS set_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      quantity_required INTEGER NOT NULL,
      FOREIGN KEY (set_id) REFERENCES product_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER,
      table_name TEXT,
      start_time DATETIME,
      end_time DATETIME,
      product_cost REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      cash_amount REAL DEFAULT 0,
      card_amount REAL DEFAULT 0,
      payment_type TEXT DEFAULT 'cash',
      products_json TEXT DEFAULT '[]',
      deleted_from_main INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      table_id INTEGER NOT NULL,
      reservation_time DATETIME NOT NULL,
      guests_count INTEGER DEFAULT 2,
      duration_minutes INTEGER DEFAULT 120,
      notes TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      date TEXT PRIMARY KEY,
      general_notes TEXT DEFAULT '',
      rows_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations for existing databases
  const safeAlter = (sql: string) => {
    try {
      db.prepare(sql).run();
    } catch {}
  };

  safeAlter("ALTER TABLE active_sessions ADD COLUMN is_already_paid INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN billing_mode TEXT DEFAULT 'adi'");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN deposit_amount REAL DEFAULT 0");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN guest_note TEXT DEFAULT ''");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN reminder_enabled INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN reminder_minutes INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN reminder_end_time INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE active_sessions ADD COLUMN reminder_notified INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE inventory ADD COLUMN purchase_price REAL DEFAULT 0");
  safeAlter("ALTER TABLE inventory ADD COLUMN is_stockless INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE inventory ADD COLUMN original_quantity INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE transactions ADD COLUMN service_fee REAL DEFAULT 0");
  safeAlter("ALTER TABLE transactions ADD COLUMN cash_amount REAL DEFAULT 0");
  safeAlter("ALTER TABLE transactions ADD COLUMN card_amount REAL DEFAULT 0");
  safeAlter("ALTER TABLE transactions ADD COLUMN payment_type TEXT DEFAULT 'cash'");
  safeAlter("ALTER TABLE transactions ADD COLUMN deleted_from_main INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE reservations ADD COLUMN guests_count INTEGER DEFAULT 2");
  safeAlter("ALTER TABLE reservations ADD COLUMN duration_minutes INTEGER DEFAULT 120");

  try {
    db.prepare("UPDATE inventory SET original_quantity = stock_quantity WHERE original_quantity = 0").run();
  } catch {}

  const seedSettings = [
    { key: "language", value: "az" },
    { key: "service_fee", value: "0" },
    { key: "reminder_minutes", value: "40" },
    { key: "reminder_message", value: "Təyin olunan vaxt tamam oldu! Zəhmət olmasa masa ilə maraqlanın." },
    { key: "admin_password", value: "MagaPsSystem2026!" },
    { key: "action_password", value: "Elgun-96" },
    { key: "report_password", value: "Admin123" }
  ];

  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  seedSettings.forEach((s) => insertSetting.run(s.key, s.value));

  // Seed default tables if empty
  const tableCount = db.prepare("SELECT COUNT(*) as count FROM tables").get() as { count: number };
  if (tableCount.count === 0) {
    const insertTable = db.prepare("INSERT INTO tables (name, type) VALUES (?, ?)");
    for (let i = 1; i <= 4; i++) {
      insertTable.run(`Kabinet ${i}`, "kabinet");
    }
    for (let i = 1; i <= 10; i++) {
      insertTable.run(`Masa ${i}`, "table");
    }
  }

  // Normalize legacy table names/types if migrating
  try {
    db.prepare("UPDATE tables SET name = REPLACE(name, 'Cabin', 'Kabinet') WHERE name LIKE 'Cabin %'").run();
    db.prepare("UPDATE tables SET name = REPLACE(name, 'Table ', 'Masa ') WHERE name LIKE 'Table %'").run();
    db.prepare("UPDATE tables SET type = 'kabinet' WHERE type = 'cabin'").run();
  } catch {}

  // Seed default Restaurant & Cafe inventory, menu products, and combo sets if empty
  const invCount = db.prepare("SELECT COUNT(*) as count FROM inventory").get() as { count: number };
  const prodCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };

  if (invCount.count === 0 && prodCount.count === 0) {
    const insertInv = db.prepare(
      "INSERT INTO inventory (name, stock_quantity, original_quantity, purchase_price, price, is_stockless) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertProd = db.prepare(
      "INSERT INTO products (name, price, category, inventory_id) VALUES (?, ?, ?, ?)"
    );

    const teaId = insertInv.run("Çay Dəstgahı (Çaynik)", 0, 0, 1.5, 6.0, 1).lastInsertRowid;
    const capId = insertInv.run("Kapuçino", 0, 0, 1.2, 4.5, 1).lastInsertRowid;
    const ameId = insertInv.run("Amerikano", 0, 0, 1.0, 3.5, 1).lastInsertRowid;
    const colaId = insertInv.run("Coca-Cola 0.33L", 48, 48, 1.1, 2.5, 0).lastInsertRowid;
    const waterId = insertInv.run("Qazsız Su 0.5L", 60, 60, 0.4, 1.5, 0).lastInsertRowid;
    const limonadId = insertInv.run("Evsayağı Limonad 1L", 0, 0, 1.8, 6.0, 1).lastInsertRowid;
    const sezarId = insertInv.run("Toyuqlu Sezar Salatı", 0, 0, 3.5, 9.5, 1).lastInsertRowid;
    const clubId = insertInv.run("Klub Sendviç & Fri", 0, 0, 3.2, 8.5, 1).lastInsertRowid;
    const burgerId = insertInv.run("Cheeseburger & Fri", 0, 0, 3.8, 10.5, 1).lastInsertRowid;
    const pizzaId = insertInv.run("Miks Pizza (Orta)", 0, 0, 4.2, 13.0, 1).lastInsertRowid;
    const cakeId = insertInv.run("San Sebastian Çizkeyk", 20, 20, 2.8, 7.0, 0).lastInsertRowid;
    const paxlavaId = insertInv.run("Milli Paxlava Porsiya", 25, 25, 2.0, 5.5, 0).lastInsertRowid;

    insertProd.run("Çaynik Çay", 6.0, "İsti İçkilər", teaId);
    insertProd.run("Kapuçino", 4.5, "İsti İçkilər", capId);
    insertProd.run("Amerikano", 3.5, "İsti İçkilər", ameId);
    insertProd.run("Coca-Cola 0.33L", 2.5, "Soyuq İçkilər", colaId);
    insertProd.run("Qazsız Su 0.5L", 1.5, "Soyuq İçkilər", waterId);
    insertProd.run("Evsayağı Limonad 1L", 6.0, "Soyuq İçkilər", limonadId);
    insertProd.run("Toyuqlu Sezar Salatı", 9.5, "Yeməklər", sezarId);
    insertProd.run("Klub Sendviç & Fri", 8.5, "Yeməklər", clubId);
    insertProd.run("Cheeseburger & Fri", 10.5, "Yeməklər", burgerId);
    insertProd.run("Miks Pizza (Orta)", 13.0, "Yeməklər", pizzaId);
    insertProd.run("San Sebastian Çizkeyk", 7.0, "Desertlər", cakeId);
    insertProd.run("Milli Paxlava Porsiya", 5.5, "Desertlər", paxlavaId);

    const insertSet = db.prepare("INSERT INTO product_sets (name, total_price) VALUES (?, ?)");
    const insertSetItem = db.prepare("INSERT INTO set_items (set_id, inventory_id, quantity_required) VALUES (?, ?, ?)");

    const teaSetId = insertSet.run("Çay Süfrəsi Seti", 10.5).lastInsertRowid;
    insertSetItem.run(teaSetId, teaId, 1);
    insertSetItem.run(teaSetId, paxlavaId, 1);

    const lunchSetId = insertSet.run("İkili Burger & Pizza Kombo", 25.0).lastInsertRowid;
    insertSetItem.run(lunchSetId, burgerId, 1);
    insertSetItem.run(lunchSetId, pizzaId, 1);
    insertSetItem.run(lunchSetId, colaId, 2);
  }
}

initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ type: ["application/json", "text/plain"] }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.text());

  // --- Auth Routes ---
  app.post("/api/auth/login", (req, res) => {
    const { password, machineId } = req.body;
    const adminPassword = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;

    if (adminPassword && password === adminPassword.value) {
      const token = crypto.randomBytes(32).toString("hex");
      db.prepare("INSERT INTO auth_sessions (token, machine_id) VALUES (?, ?)").run(token, machineId);
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const { token } = req.body;
    db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    res.json({ success: true });
  });

  app.post("/api/auth/check", (req, res) => {
    const { token, machineId } = req.body;
    const session = db.prepare("SELECT * FROM auth_sessions WHERE token = ? AND machine_id = ?").get(token, machineId);
    if (session) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false });
    }
  });

  app.post("/api/auth/verify-report", (req, res) => {
    const { password } = req.body;
    const reportPassword = db.prepare("SELECT value FROM settings WHERE key = 'report_password'").get() as { value: string } | undefined;
    if (reportPassword && password === reportPassword.value) {
      res.json({ success: true });
    } else {
      res.status(403).json({ success: false });
    }
  });

  // Passwords & Security
  app.post("/api/settings/action-password/verify", (req, res) => {
    const { password } = req.body;
    const actionPassword = db.prepare("SELECT value FROM settings WHERE key = 'action_password'").get() as { value: string } | undefined;
    if (actionPassword && password === actionPassword.value) {
      res.json({ success: true });
    } else {
      res.status(403).json({ success: false });
    }
  });

  app.post("/api/settings/action-password/update", (req, res) => {
    const { currentActionPassword, newActionPassword } = req.body;
    const actionPassword = db.prepare("SELECT value FROM settings WHERE key = 'action_password'").get() as { value: string } | undefined;

    if (!actionPassword || currentActionPassword !== actionPassword.value) {
      return res.status(403).json({ success: false, message: "Invalid current action password" });
    }

    db.prepare("UPDATE settings SET value = ? WHERE key = 'action_password'").run(newActionPassword);
    res.json({ success: true });
  });

  app.post("/api/settings/report-password/verify", (req, res) => {
    const { password } = req.body;
    const reportPassword = db.prepare("SELECT value FROM settings WHERE key = 'report_password'").get() as { value: string } | undefined;
    if (reportPassword && password === reportPassword.value) {
      res.json({ success: true });
    } else {
      res.status(403).json({ success: false });
    }
  });

  app.post("/api/settings/report-password/update", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const reportPassword = db.prepare("SELECT value FROM settings WHERE key = 'report_password'").get() as { value: string } | undefined;

    if (!reportPassword || currentPassword !== reportPassword.value) {
      return res.status(403).json({ success: false, message: "Invalid current report password" });
    }

    db.prepare("UPDATE settings SET value = ? WHERE key = 'report_password'").run(newPassword);
    res.json({ success: true });
  });

  app.post("/api/settings/main-password/verify", (req, res) => {
    const { password } = req.body;
    const adminPassword = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;
    if (adminPassword && password === adminPassword.value) {
      res.json({ success: true });
    } else {
      res.status(403).json({ success: false });
    }
  });

  app.post("/api/settings/admin-password/update", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const adminPassword = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;

    if (!adminPassword || currentPassword !== adminPassword.value) {
      return res.status(401).json({ error: "Current password incorrect" });
    }

    db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'").run(newPassword);
    res.json({ success: true });
  });

  // --- Tables ---
  app.get("/api/tables", (req, res) => {
    const tables = db.prepare("SELECT id, name, type FROM tables ORDER BY id ASC").all();
    res.json(tables);
  });

  app.post("/api/tables", (req, res) => {
    const { name, type } = req.body;
    const result = db.prepare("INSERT INTO tables (name, type) VALUES (?, ?)").run(name, type || "table");
    res.json({ id: result.lastInsertRowid, name, type: type || "table" });
  });

  app.put("/api/tables/:id", (req, res) => {
    const { name, type } = req.body;
    db.prepare("UPDATE tables SET name = ?, type = ? WHERE id = ?").run(name, type || "table", req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/tables/:id", (req, res) => {
    db.prepare("DELETE FROM tables WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM active_sessions WHERE table_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Active Table Orders (Sessions) ---
  app.get("/api/active_sessions", (req, res) => {
    const sessions = db.prepare("SELECT * FROM active_sessions").all();
    const formatted = sessions.map((s: any) => ({
      tableId: s.table_id,
      startTime: s.start_time,
      isAlreadyPaid: !!s.is_already_paid,
      billingMode: s.billing_mode || "adi",
      depositAmount: s.deposit_amount || 0,
      guestNote: s.guest_note || "",
      reminderEnabled: !!s.reminder_enabled,
      reminderMinutes: s.reminder_minutes || 0,
      reminderEndTime: s.reminder_end_time || 0,
      reminderNotified: !!s.reminder_notified,
      products: JSON.parse(s.products_json || "[]")
    }));
    res.json(formatted);
  });

  app.post("/api/active_sessions", (req, res) => {
    const {
      tableId,
      startTime,
      products,
      isAlreadyPaid,
      billingMode,
      depositAmount,
      guestNote,
      reminderEnabled,
      reminderMinutes,
      reminderEndTime,
      reminderNotified
    } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO active_sessions (
        table_id, start_time, products_json, is_already_paid, billing_mode, deposit_amount, guest_note,
        reminder_enabled, reminder_minutes, reminder_end_time, reminder_notified
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tableId,
      startTime || Date.now(),
      JSON.stringify(products || []),
      isAlreadyPaid ? 1 : 0,
      billingMode || "adi",
      depositAmount || 0,
      guestNote || "",
      reminderEnabled ? 1 : 0,
      reminderMinutes || 0,
      reminderEndTime || 0,
      reminderNotified ? 1 : 0
    );
    res.json({ success: true });
  });

  app.put("/api/active_sessions/:tableId", (req, res) => {
    const {
      startTime,
      products,
      isAlreadyPaid,
      billingMode,
      depositAmount,
      guestNote,
      reminderEnabled,
      reminderMinutes,
      reminderEndTime,
      reminderNotified
    } = req.body;
    db.prepare(`
      UPDATE active_sessions 
      SET start_time = ?, products_json = ?, is_already_paid = ?, billing_mode = ?, deposit_amount = ?, guest_note = ?,
          reminder_enabled = ?, reminder_minutes = ?, reminder_end_time = ?, reminder_notified = ?
      WHERE table_id = ?
    `).run(
      startTime || Date.now(),
      JSON.stringify(products || []),
      isAlreadyPaid ? 1 : 0,
      billingMode || "adi",
      depositAmount || 0,
      guestNote || "",
      reminderEnabled ? 1 : 0,
      reminderMinutes || 0,
      reminderEndTime || 0,
      reminderNotified ? 1 : 0,
      req.params.tableId
    );
    res.json({ success: true });
  });

  app.delete("/api/active_sessions/:tableId", (req, res) => {
    db.prepare("DELETE FROM active_sessions WHERE table_id = ?").run(req.params.tableId);
    res.json({ success: true });
  });

  // --- Menu Products ---
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY id ASC").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, price, category, inventory_id } = req.body;
    const result = db
      .prepare("INSERT INTO products (name, price, category, inventory_id) VALUES (?, ?, ?, ?)")
      .run(name, price, category, inventory_id || null);
    res.json({ id: result.lastInsertRowid, name, price, category, inventory_id });
  });

  app.put("/api/products/:id", (req, res) => {
    const { name, price, category, inventory_id } = req.body;
    db.prepare("UPDATE products SET name = ?, price = ?, category = ?, inventory_id = ? WHERE id = ?").run(
      name,
      price,
      category,
      inventory_id || null,
      req.params.id
    );
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Inventory ---
  app.get("/api/inventory", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory ORDER BY id ASC").all();
    res.json(items);
  });

  app.post("/api/inventory", (req, res) => {
    const { name, stock_quantity, purchase_price, price, is_stockless } = req.body;
    const original_quantity = is_stockless ? 0 : stock_quantity;
    const result = db
      .prepare(
        "INSERT INTO inventory (name, stock_quantity, original_quantity, purchase_price, price, is_stockless) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(name, stock_quantity || 0, original_quantity || 0, purchase_price || 0, price || 0, is_stockless ? 1 : 0);
    res.json({ id: result.lastInsertRowid, name, stock_quantity, purchase_price, price, is_stockless: !!is_stockless });
  });

  app.put("/api/inventory/:id", (req, res) => {
    const { name, stock_quantity, purchase_price, price, is_stockless } = req.body;
    const existing = db.prepare("SELECT stock_quantity FROM inventory WHERE id = ?").get(req.params.id) as any;

    if (existing && existing.stock_quantity !== stock_quantity) {
      db.prepare(
        "UPDATE inventory SET name = ?, stock_quantity = ?, original_quantity = ?, purchase_price = ?, price = ?, is_stockless = ? WHERE id = ?"
      ).run(name, stock_quantity || 0, stock_quantity || 0, purchase_price || 0, price || 0, is_stockless ? 1 : 0, req.params.id);
    } else {
      db.prepare("UPDATE inventory SET name = ?, purchase_price = ?, price = ?, is_stockless = ? WHERE id = ?").run(
        name,
        purchase_price || 0,
        price || 0,
        is_stockless ? 1 : 0,
        req.params.id
      );
    }
    res.json({ success: true });
  });

  app.delete("/api/inventory/:id", (req, res) => {
    db.prepare("DELETE FROM inventory WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Combo / Menu Sets ---
  app.get("/api/product_sets", (req, res) => {
    const sets = db.prepare("SELECT * FROM product_sets ORDER BY id ASC").all();
    const setsWithItems = sets.map((s: any) => {
      const items = db
        .prepare(`
        SELECT si.*, i.name as inventory_name 
        FROM set_items si 
        JOIN inventory i ON si.inventory_id = i.id 
        WHERE si.set_id = ?
      `)
        .all(s.id);
      return { ...s, items };
    });
    res.json(setsWithItems);
  });

  app.post("/api/product_sets", (req, res) => {
    const { name, total_price, items } = req.body;
    const transaction = db.transaction(() => {
      const result = db.prepare("INSERT INTO product_sets (name, total_price) VALUES (?, ?)").run(name, total_price);
      const setId = result.lastInsertRowid;

      const insertItem = db.prepare("INSERT INTO set_items (set_id, inventory_id, quantity_required) VALUES (?, ?, ?)");
      for (const item of (items || []) as any[]) {
        insertItem.run(setId, item.inventory_id, item.quantity_required);
      }

      return setId;
    });
    const setId = transaction();
    res.json({ id: setId, name, total_price, items: items || [] });
  });

  app.put("/api/product_sets/:id", (req, res) => {
    const { name, total_price, items } = req.body;
    const transaction = db.transaction(() => {
      db.prepare("UPDATE product_sets SET name = ?, total_price = ? WHERE id = ?").run(name, total_price, req.params.id);

      db.prepare("DELETE FROM set_items WHERE set_id = ?").run(req.params.id);
      const insertItem = db.prepare("INSERT INTO set_items (set_id, inventory_id, quantity_required) VALUES (?, ?, ?)");
      for (const item of (items || []) as any[]) {
        insertItem.run(req.params.id, item.inventory_id, item.quantity_required);
      }
    });
    transaction();
    res.json({ success: true });
  });

  app.delete("/api/product_sets/:id", (req, res) => {
    db.prepare("DELETE FROM product_sets WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Settings ---
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      if (!["admin_password", "action_password", "report_password"].includes(curr.key)) {
        acc[curr.key] = curr.value;
      }
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const { settings } = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(settings || {})) {
      if (!["admin_password", "action_password", "report_password"].includes(key)) {
        upsert.run(key, String(value));
      }
    }
    res.json({ success: true });
  });

  // --- Transactions & Billing ---
  app.get("/api/transactions", (req, res) => {
    const { startDate, endDate } = req.query;
    let query = "SELECT * FROM transactions WHERE deleted_from_main = 0";
    const params: any[] = [];

    if (startDate && endDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
      params.push(start, end);
    } else if (startDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      query += " AND datetime(created_at) >= datetime(?)";
      params.push(start);
    } else if (endDate) {
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) <= datetime(?)";
      params.push(end);
    }

    query += " ORDER BY created_at DESC";
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const {
      table_id,
      table_name,
      start_time,
      end_time,
      product_cost,
      service_fee,
      total_cost,
      products_json,
      cash_amount,
      card_amount,
      payment_type
    } = req.body;

    const transaction = db.transaction(() => {
      const result = db
        .prepare(`
        INSERT INTO transactions (table_id, table_name, start_time, end_time, product_cost, service_fee, total_cost, products_json, cash_amount, card_amount, payment_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          table_id,
          table_name,
          start_time,
          end_time,
          product_cost || 0,
          service_fee || 0,
          total_cost || 0,
          products_json || "[]",
          cash_amount || 0,
          card_amount || 0,
          payment_type || "cash"
        );

      // Decrement inventory stock for non-stockless items
      const products = JSON.parse(products_json || "[]");
      for (const p of products) {
        if (p.is_set) {
          const setItems = db
            .prepare(`
            SELECT si.*, i.is_stockless 
            FROM set_items si 
            JOIN inventory i ON si.inventory_id = i.id 
            WHERE si.set_id = ?
          `)
            .all(p.set_id);
          for (const item of setItems as any[]) {
            if (!item.is_stockless) {
              db.prepare("UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
                item.quantity_required * p.quantity,
                item.inventory_id
              );
            }
          }
        } else if (p.inventory_id) {
          const invItem = db.prepare("SELECT is_stockless FROM inventory WHERE id = ?").get(p.inventory_id) as any;
          if (invItem && !invItem.is_stockless) {
            db.prepare("UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
              p.quantity,
              p.inventory_id
            );
          }
        }
      }

      return result.lastInsertRowid;
    });

    const id = transaction();
    res.json({ id });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const { reportType } = req.query;
    if (reportType === "main") {
      db.prepare("UPDATE transactions SET deleted_from_main = 1 WHERE id = ?").run(req.params.id);
    } else {
      db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    }
    res.json({ success: true });
  });

  app.delete("/api/transactions", (req, res) => {
    const { startDate, endDate, reportType } = req.query;
    let query =
      reportType === "main"
        ? "UPDATE transactions SET deleted_from_main = 1 WHERE 1=1"
        : "DELETE FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (startDate && endDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
      params.push(start, end);
    } else if (startDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      query += " AND datetime(created_at) >= datetime(?)";
      params.push(start);
    } else if (endDate) {
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) <= datetime(?)";
      params.push(end);
    } else {
      return res.status(400).json({ success: false, message: "Date range required" });
    }

    db.prepare(query).run(...params);
    res.json({ success: true });
  });

  // --- Reports ---
  app.get("/api/reports/inventory-profit", (req, res) => {
    const { startDate, endDate } = req.query;
    const resetSetting = db.prepare("SELECT value FROM settings WHERE key = 'inventory_profit_reset_at'").get() as any;
    const resetAt = resetSetting ? resetSetting.value : null;

    let query = "SELECT products_json, created_at, payment_type FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (resetAt) {
      query += " AND datetime(created_at) > datetime(?)";
      params.push(resetAt);
    }

    if (startDate && endDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
      params.push(start, end);
    } else if (startDate) {
      const start = String(startDate).includes(":") ? startDate : `${startDate} 00:00:00`;
      query += " AND datetime(created_at) >= datetime(?)";
      params.push(start);
    } else if (endDate) {
      const end = String(endDate).includes(":") ? endDate : `${endDate} 23:59:59`;
      query += " AND datetime(created_at) <= datetime(?)";
      params.push(end);
    }

    const transactions = db.prepare(query).all(...params);
    const inventory = db.prepare("SELECT * FROM inventory WHERE is_stockless = 0").all() as any[];
    const products = db
      .prepare("SELECT p.* FROM products p JOIN inventory i ON p.inventory_id = i.id WHERE i.is_stockless = 0")
      .all() as any[];

    const stats: { [key: number]: any } = {};

    inventory.forEach((item) => {
      stats[item.id] = {
        id: item.id,
        name: item.name,
        stock_left: item.stock_quantity,
        original_quantity: item.original_quantity || item.stock_quantity,
        sold_quantity: 0,
        purchase_price: item.purchase_price,
        selling_price: 0,
        revenue: 0,
        profit: 0,
        spent_money: 0
      };

      const linkedProduct = products.find((p) => p.inventory_id === item.id);
      if (linkedProduct) {
        stats[item.id].selling_price = linkedProduct.price;
      }
    });

    transactions.forEach((t: any) => {
      const items = JSON.parse(t.products_json || "[]");
      const isUnpaid = t.payment_type === "unpaid";

      items.forEach((p: any) => {
        if (p.is_set) {
          const setItems = db.prepare("SELECT * FROM set_items WHERE set_id = ?").all(p.set_id);
          for (const item of setItems as any[]) {
            if (stats[item.inventory_id]) {
              const qty = item.quantity_required * p.quantity;
              const s = stats[item.inventory_id];
              s.sold_quantity += qty;
              s.spent_money += qty * s.purchase_price;

              if (!isUnpaid) {
                s.revenue += qty * s.selling_price;
                s.profit += qty * (s.selling_price - s.purchase_price);
              } else {
                s.profit -= qty * s.purchase_price;
              }
            }
          }
        } else if (p.inventory_id && stats[p.inventory_id]) {
          const s = stats[p.inventory_id];
          s.sold_quantity += p.quantity;
          s.spent_money += p.quantity * s.purchase_price;

          if (!isUnpaid) {
            s.revenue += p.quantity * p.price;
            s.profit += p.quantity * (p.price - s.purchase_price);
            s.selling_price = p.price;
          } else {
            s.profit -= p.quantity * s.purchase_price;
          }
        }
      });
    });

    res.json(Object.values(stats));
  });

  app.post("/api/reports/inventory-profit/reset", (req, res) => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('inventory_profit_reset_at', CURRENT_TIMESTAMP)").run();
    const resetSetting = db.prepare("SELECT value FROM settings WHERE key = 'inventory_profit_reset_at'").get() as any;
    res.json({ success: true, resetAt: resetSetting ? resetSetting.value : null });
  });

  app.get("/api/reports/summary", (req, res) => {
    const queryDaily = `
      SELECT 
        SUM(t.total_cost) as total,
        SUM(t.cash_amount) as cash,
        SUM(t.card_amount) as card
      FROM transactions t
      WHERE date(t.created_at, '+4 hours') = date('now', '+4 hours') 
      AND t.payment_type != 'unpaid'
      AND t.deleted_from_main = 0
    `;

    const queryMonthly = `
      SELECT 
        SUM(t.total_cost) as total,
        SUM(t.cash_amount) as cash,
        SUM(t.card_amount) as card
      FROM transactions t
      WHERE strftime('%m', t.created_at, '+4 hours') = strftime('%m', 'now', '+4 hours') 
      AND strftime('%Y', t.created_at, '+4 hours') = strftime('%Y', 'now', '+4 hours') 
      AND t.payment_type != 'unpaid'
      AND t.deleted_from_main = 0
    `;

    const queryTotal = `
      SELECT 
        SUM(t.total_cost) as total,
        SUM(t.cash_amount) as cash,
        SUM(t.card_amount) as card
      FROM transactions t
      WHERE t.payment_type != 'unpaid'
      AND t.deleted_from_main = 0
    `;

    const queryLast7Days = `
      SELECT 
        date(t.created_at, '+4 hours') as date, 
        SUM(t.total_cost) as revenue 
      FROM transactions t
      WHERE date(t.created_at, '+4 hours') >= date('now', '+4 hours', '-6 days') 
      AND t.payment_type != 'unpaid'
      AND t.deleted_from_main = 0
      GROUP BY date(t.created_at, '+4 hours')
      ORDER BY date(t.created_at, '+4 hours') ASC
    `;

    const daily = db.prepare(queryDaily).get() as any;
    const monthly = db.prepare(queryMonthly).get() as any;
    const total = db.prepare(queryTotal).get() as any;
    const last7Days = db.prepare(queryLast7Days).all();

    res.json({
      daily: daily?.total || 0,
      dailyCash: daily?.cash || 0,
      dailyCard: daily?.card || 0,
      monthly: monthly?.total || 0,
      monthlyCash: monthly?.cash || 0,
      monthlyCard: monthly?.card || 0,
      total: total?.total || 0,
      totalCash: total?.cash || 0,
      totalCard: total?.card || 0,
      chartData: last7Days
    });
  });

  // --- Reservations ---
  const hasReservationConflict = (tableId: number, startTimeStr: string, durationMinutes: number, excludeId?: number) => {
    const newStart = new Date(startTimeStr).getTime();
    const newEnd = newStart + (durationMinutes || 120) * 60000;

    const query = excludeId
      ? db.prepare("SELECT * FROM reservations WHERE table_id = ? AND status != 'cancelled' AND id != ?").all(tableId, excludeId)
      : db.prepare("SELECT * FROM reservations WHERE table_id = ? AND status != 'cancelled'").all(tableId);

    for (const r of query as any[]) {
      const existingStart = new Date(r.reservation_time).getTime();
      const existingEnd = existingStart + (r.duration_minutes || 120) * 60000;
      if (newStart < existingEnd && newEnd > existingStart) {
        return r;
      }
    }
    return null;
  };

  app.get("/api/reservations", (req, res) => {
    const reservations = db
      .prepare(`
      SELECT r.*, t.name as table_name, t.type as table_type 
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      ORDER BY r.reservation_time ASC
    `)
      .all();
    res.json(reservations);
  });

  app.post("/api/reservations", (req, res) => {
    const { customer_name, customer_phone, table_id, reservation_time, guests_count, duration_minutes, notes, status } = req.body;

    if (!customer_name || !table_id || !reservation_time) {
      return res.status(400).json({ error: "Missing required reservation fields" });
    }

    const duration = duration_minutes ? parseInt(duration_minutes, 10) : 120;
    const guests = guests_count ? parseInt(guests_count, 10) : 2;
    const conflict = hasReservationConflict(table_id, reservation_time, duration);
    if (conflict) {
      return res.status(409).json({
        error: "DOUBLE_BOOKING",
        message: "Bu masa/kabinet qeyd olunan vaxtda artıq rezerv edilib.",
        conflictingReservation: conflict
      });
    }

    const result = db
      .prepare(`
      INSERT INTO reservations (customer_name, customer_phone, table_id, reservation_time, guests_count, duration_minutes, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        customer_name,
        customer_phone || null,
        table_id,
        reservation_time,
        guests,
        duration,
        notes || null,
        status || "confirmed"
      );

    res.json({ id: result.lastInsertRowid, success: true });
  });

  app.put("/api/reservations/:id", (req, res) => {
    const { id } = req.params;
    const { customer_name, customer_phone, table_id, reservation_time, guests_count, duration_minutes, notes, status } = req.body;

    if (!customer_name || !table_id || !reservation_time) {
      return res.status(400).json({ error: "Missing required reservation fields" });
    }

    const duration = duration_minutes ? parseInt(duration_minutes, 10) : 120;
    const guests = guests_count ? parseInt(guests_count, 10) : 2;
    if (status !== "cancelled") {
      const conflict = hasReservationConflict(table_id, reservation_time, duration, parseInt(id, 10));
      if (conflict) {
        return res.status(409).json({
          error: "DOUBLE_BOOKING",
          message: "Bu masa/kabinet qeyd olunan vaxtda artıq rezerv edilib.",
          conflictingReservation: conflict
        });
      }
    }

    db.prepare(`
      UPDATE reservations 
      SET customer_name = ?, customer_phone = ?, table_id = ?, reservation_time = ?, guests_count = ?, duration_minutes = ?, notes = ?, status = ?
      WHERE id = ?
    `).run(
      customer_name,
      customer_phone || null,
      table_id,
      reservation_time,
      guests,
      duration,
      notes || null,
      status || "confirmed",
      id
    );

    res.json({ success: true });
  });

  app.delete("/api/reservations/:id", (req, res) => {
    db.prepare("DELETE FROM reservations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Daily Notes ---
  app.get("/api/daily-notes", (req, res) => {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });
    }

    const row = db.prepare("SELECT * FROM daily_notes WHERE date = ?").get(date) as any;
    if (!row) {
      return res.json({
        date,
        general_notes: "",
        rows: [],
        updated_at: null
      });
    }

    let parsedRows: any[] = [];
    try {
      parsedRows = JSON.parse(row.rows_json || "[]");
    } catch {
      parsedRows = [];
    }

    res.json({
      date: row.date,
      general_notes: row.general_notes || "",
      rows: parsedRows,
      updated_at: row.updated_at
    });
  });

  app.post("/api/daily-notes", (req, res) => {
    const { date, general_notes, rows } = req.body;
    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "Date is required (YYYY-MM-DD)" });
    }

    const rowsJson = JSON.stringify(Array.isArray(rows) ? rows : []);
    const notesText = typeof general_notes === "string" ? general_notes : "";

    db.prepare(`
      INSERT INTO daily_notes (date, general_notes, rows_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date) DO UPDATE SET
        general_notes = excluded.general_notes,
        rows_json = excluded.rows_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(date, notesText, rowsJson);

    res.json({
      success: true,
      date,
      general_notes: notesText,
      rows: Array.isArray(rows) ? rows : [],
      updated_at: new Date().toISOString()
    });
  });

  app.get("/api/daily-notes/history", (req, res) => {
    const history = db
      .prepare(`
      SELECT 
        date,
        updated_at,
        length(general_notes) as notes_length,
        rows_json
      FROM daily_notes
      ORDER BY date DESC
      LIMIT 120
    `)
      .all();

    const formatted = history.map((item: any) => {
      let rowCount = 0;
      try {
        const rows = JSON.parse(item.rows_json || "[]");
        rowCount = Array.isArray(rows) ? rows.length : 0;
      } catch {
        rowCount = 0;
      }
      return {
        date: item.date,
        updated_at: item.updated_at,
        notes_length: item.notes_length || 0,
        row_count: rowCount,
        has_content: (item.notes_length || 0) > 0 || rowCount > 0
      };
    });

    res.json(formatted);
  });

  app.delete("/api/daily-notes", (req, res) => {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      return res.status(400).json({ error: "Date parameter is required" });
    }
    db.prepare("DELETE FROM daily_notes WHERE date = ?").run(date);
    res.json({ success: true });
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const handleExit = (signal?: string) => {
    if (signal) {
      console.log(`Server process exiting (Signal: ${signal})`);
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => handleExit("SIGTERM"));
  process.on("SIGINT", () => handleExit("SIGINT"));
  process.on("SIGUSR2", () => handleExit("SIGUSR2"));
  process.on("exit", () => handleExit());
}

startServer();
