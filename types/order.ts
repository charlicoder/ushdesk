export type DeliveryStatus =
  | 'ordered'
  | 'ready_to_go'
  | 'on_the_way'
  | 'delivered'
  | 'received'
  | string;

export interface DeliveryAddressObj {
  area?: string | null;
  block?: string | null;
  street?: string | null;
  building_no?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city?: string | null;
  formatted?: string | null;
  [key: string]: unknown;
}

export interface OrderItem {
  id?: string | number;
  name: string;
  sku?: string;
  quantity: number;
  unit_price?: string | number;
  total_price?: string | number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string | null;
  contact_number?: string | null;
  delivery_address: DeliveryAddressObj | string | null;
  delivery_address_formatted: string;
  total_amount?: string;
  currency?: string;
  delivery_status: DeliveryStatus;
  delivery_status_label?: string;
  delivery_status_label_ar?: string;
  payment_status?: string;
  items_count?: number;
  public_token?: string;
  token_expires_at?: string;
  tracking_url?: string;
  tracking_code?: string | null;
  created_at: string;
  updated_at?: string | null;
  [key: string]: unknown;
}
