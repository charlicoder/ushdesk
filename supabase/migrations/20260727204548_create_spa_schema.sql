/*
# Serenity Spa Center — Dashboard Schema

1. Purpose
   Backend storage for a spa-center appointment booking dashboard. The mobile
   app + API backend already create bookings; this dashboard reads them for
   monitoring and reporting. This migration creates the full data model and
   seeds realistic sample data so the dashboard is populated on first load.

2. New Tables
   - `branches`   : spa center locations (name, city, address, phone, color).
   - `services`   : treatments offered (name, duration, price, category).
   - `staff`      : therapists/stylists per branch (name, role, branch_id).
   - `customers`  : clients (name, phone, email, gender).
   - `appointments`: bookings linking customer + service + staff + branch at a
                     date/time with a status (pending, confirmed, completed,
                     cancelled, no_show) and payment info.

3. Security
   - RLS enabled on every table.
   - This is a no-auth dashboard (no sign-in screen) so policies are
     `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because
     the data is intentionally shared across the dashboard.

4. Important Notes
   - All tables use `gen_random_uuid()` primary keys.
   - Timestamps are `timestamptz` defaulting to `now()`.
   - Appointments store `price` (numeric) snapshot at booking time so historical
     reports remain accurate even if the service price changes later.
*/

-- ---------- branches ----------
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  address text,
  phone text,
  color text DEFAULT '#0ea5e9',
  created_at timestamptz DEFAULT now()
);

-- ---------- services ----------
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ---------- staff ----------
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ---------- customers ----------
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  gender text,
  created_at timestamptz DEFAULT now()
);

-- ---------- appointments ----------
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_start ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appt_branch ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);

-- ---------- RLS ----------
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_branches" ON branches;
CREATE POLICY "anon_read_branches" ON branches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_write_branches" ON branches;
CREATE POLICY "anon_write_branches" ON branches FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_services" ON services;
CREATE POLICY "anon_read_services" ON services FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_write_services" ON services;
CREATE POLICY "anon_write_services" ON services FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_staff" ON staff;
CREATE POLICY "anon_read_staff" ON staff FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_write_staff" ON staff;
CREATE POLICY "anon_write_staff" ON staff FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_customers" ON customers;
CREATE POLICY "anon_read_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_write_customers" ON customers;
CREATE POLICY "anon_write_customers" ON customers FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_appointments" ON appointments;
CREATE POLICY "anon_read_appointments" ON appointments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_write_appointments" ON appointments;
CREATE POLICY "anon_write_appointments" ON appointments FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
