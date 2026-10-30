export interface Table {
  id: number;
  name: string;
  type: 'kabinet' | 'table';
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  inventory_id?: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  stock_quantity: number;
  original_quantity?: number;
  purchase_price: number;
  price?: number;
  is_stockless?: boolean;
}

export interface SetItem {
  id?: number;
  set_id?: number;
  inventory_id: number;
  inventory_name?: string;
  quantity_required: number;
}

export interface ProductSet {
  id: number;
  name: string;
  total_price: number;
  items: SetItem[];
}

export interface SessionProduct extends Product {
  quantity: number;
  is_set?: boolean;
  set_id?: number;
}

export interface Transaction {
  id: number;
  table_id: number;
  table_name: string;
  start_time: string;
  end_time: string;
  product_cost: number;
  service_fee?: number;
  total_cost: number;
  cash_amount: number;
  card_amount: number;
  payment_type: 'cash' | 'card' | 'mixed' | 'unpaid';
  products_json: string;
  created_at: string;
}

export interface ActiveSession {
  tableId: number;
  startTime: number; // Timestamp when table order opened
  products: SessionProduct[];
  billingMode?: 'adi' | 'depozit';
  depositAmount?: number;
  isAlreadyPaid?: boolean;
  guestNote?: string;
  reminderEnabled?: boolean;
  reminderMinutes?: number;
  reminderEndTime?: number;
  reminderNotified?: boolean;
}

export interface Settings {
  language: string;
  service_fee?: string;
  reminder_minutes?: string;
  reminder_message?: string;
}

export interface Reservation {
  id: number;
  customer_name: string;
  customer_phone?: string;
  table_id: number;
  table_name?: string;
  table_type?: 'kabinet' | 'table';
  reservation_time: string;
  guests_count?: number;
  duration_minutes?: number;
  notes?: string;
  status: 'confirmed' | 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface DailyNoteRow {
  id: string;
  time: string;
  category: string;
  title: string;
  note: string;
  amount: string;
  is_important: boolean;
  is_done: boolean;
  created_at?: string;
}

export interface DailyNoteRecord {
  date: string;
  general_notes: string;
  rows: DailyNoteRow[];
  updated_at?: string | null;
}

export interface DailyNoteHistoryItem {
  date: string;
  updated_at: string;
  notes_length: number;
  row_count: number;
  has_content: boolean;
}
