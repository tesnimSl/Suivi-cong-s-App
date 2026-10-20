CREATE TABLE leave_adjustments (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('paid','sick')),
  month INTEGER,
  old_value NUMERIC(10,4) NOT NULL,
  new_value NUMERIC(10,4) NOT NULL,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
