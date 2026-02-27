export type UserRole = 'admin' | 'business_owner';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_code?: string;
  available_balance: number;
  pending_balance: number;
  total_orders: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_popular: boolean;
  order_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  business_id: string;
  name: string;
  addon_type: string;
  description?: string;
  is_required: boolean;
  allow_multiple: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AddonOption {
  id: string;
  addon_id: string;
  name: string;
  price: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItemAddon {
  id: string;
  menu_item_id: string;
  addon_id: string;
  is_required: boolean;
}

export interface Drink {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PopularDish {
  id: string;
  business_id: string;
  menu_item_ids: string;
  featured_image_url?: string;
  combination_name: string;
  description?: string;
  order_count: number;
  is_manual: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  business_id: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  total_amount: number;
  payment_reference?: string;
  payment_status: PaymentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  item_price: number;
  configuration?: Record<string, any>;
  created_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  order_id?: string;
  amount: number;
  transaction_type: string;
  payment_method?: string;
  payment_reference?: string;
  status: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  business_id: string;
  amount: number;
  status: WithdrawalStatus;
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_code?: string;
  payment_reference?: string;
  requested_at: string;
  processed_at?: string;
  notes?: string;
}

export interface Analytics {
  id: string;
  business_id: string;
  date: string;
  total_orders: number;
  total_revenue: number;
  unique_customers: number;
  created_at: string;
}

export interface AuthPayload {
  userId: string;
  role: UserRole;
  businessId?: string;
}

export interface SessionUser extends User {
  businessId?: string;
}

export interface CartItem {
  menuItemId: string;
  quantity: number;
  selectedAddons: {
    addonId: string;
    selectedOptions: Array<{
      optionId: string;
      name: string;
      price: number;
    }>;
  }[];
}
