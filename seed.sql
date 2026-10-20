INSERT INTO leave_years
(year, annual_paid, monthly_paid, annual_sick, initial_paid, initial_sick, sick_carry, planned_forecast, day_mode, start_month)
SELECT 2026, 22, 1.83, 5, 7.27, 5, FALSE, FALSE, 'ouvrés', 1
WHERE NOT EXISTS (SELECT 1 FROM leave_years WHERE year=2026);
