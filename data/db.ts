/**
 * data/db.ts — Data Abstraction Layer
 *
 * Single source of truth for all data reads.
 * No other file in this project reads JSON directly.
 *
 * To swap to Supabase (or any other backend):
 *   1. Replace the readJson() calls with your DB client queries
 *   2. Keep the function signatures and return types identical
 *   3. Nothing else in the project needs to change
 */

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Resolve the data/ directory relative to this file, regardless of where
// the process is invoked from
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface TrackingInfo {
  carrier: string;
  tracking_number: string;
  last_update: string;
  last_location: string;
}

export type OrderStatus = "processing" | "in_transit" | "delivered" | "cancelled";

export interface Order {
  order_id: string;
  customer_email: string;
  customer_name: string;
  status: OrderStatus;
  placed_at: string;
  delivered_at: string | null;
  shipping_address: string;
  tracking?: TrackingInfo | null;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  notes: string | null;
}

export interface ProductFAQ {
  question: string;
  answer: string;
}

export interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
  description: string;
  serving_size: string;
  servings_per_container: number;
  ingredients: string[];
  allergens: string[];
  certifications: string[];
  faqs: ProductFAQ[];
}

export interface ReturnCondition {
  condition: string;
  eligible: boolean;
  refund_type?: "full" | "partial";
  partial_refund_pct?: number;
  notes: string;
}

export interface ReturnPolicy {
  version: string;
  last_updated: string;
  summary: string;
  return_window_days: number;
  eligible_conditions: ReturnCondition[];
  ineligible_conditions: ReturnCondition[];
  auto_approve_rules: {
    max_refund_for_auto_approve: number;
    currency: string;
    notes: string;
  };
  process: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readJson<T>(filename: string): Promise<T> {
  const filepath = join(DATA_DIR, filename);
  const raw = await readFile(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Returns all orders. */
export async function getAllOrders(): Promise<Order[]> {
  return readJson<Order[]>("orders.json");
}

/** Look up a single order by order ID. Returns null if not found. */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const orders = await getAllOrders();
  return orders.find((o) => o.order_id === orderId) ?? null;
}

/** Look up all orders for a given customer email. Returns [] if none found. */
export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const orders = await getAllOrders();
  return orders.filter(
    (o) => o.customer_email.toLowerCase() === email.toLowerCase()
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Returns all products. */
export async function getAllProducts(): Promise<Product[]> {
  return readJson<Product[]>("products.json");
}

/** Look up a single product by product ID. Returns null if not found. */
export async function getProductById(productId: string): Promise<Product | null> {
  const products = await getAllProducts();
  return products.find((p) => p.product_id === productId) ?? null;
}

/** Search products by name (case-insensitive partial match). */
export async function searchProductsByName(query: string): Promise<Product[]> {
  const products = await getAllProducts();
  const lower = query.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(lower));
}

// ---------------------------------------------------------------------------
// Return Policy
// ---------------------------------------------------------------------------

/** Returns the full return policy document. */
export async function getReturnPolicy(): Promise<ReturnPolicy> {
  return readJson<ReturnPolicy>("return_policy.json");
}
