CREATE TABLE leave_operations (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('paid','sick')),
  days NUMERIC(8,2) NOT NULL CHECK (days >= 0),
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('planned','validated','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
