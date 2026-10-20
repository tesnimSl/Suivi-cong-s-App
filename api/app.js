import { db } from "hatchable";
import { calculateYear } from "lib/leave.js";

export const access = "member";
const TYPES = ["paid", "sick"];
const STATUSES = ["planned", "validated", "cancelled"];

async function audit(action, entity, id, details) {
  await db.query(
    "INSERT INTO leave_audit_log (action, entity, entity_id, details) VALUES ($1,$2,$3,$4::jsonb)",
    [action, entity, id == null ? null : String(id), JSON.stringify(details || {})]
  );
}
function normalizeConfig(b) {
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Année invalide.");
  return {
    year, annual_paid: Math.max(0, Number(b.annual_paid ?? 22)),
    monthly_paid: Math.max(0, Number(b.monthly_paid ?? 1.8333)),
    annual_sick: Math.max(0, Number(b.annual_sick ?? 5)),
    initial_paid: Number(b.initial_paid ?? 0), initial_sick: Number(b.initial_sick ?? 5),
    sick_carry: Boolean(b.sick_carry), planned_forecast: Boolean(b.planned_forecast),
    day_mode: b.day_mode === "calendaires" ? "calendaires" : "ouvrés",
    start_month: Math.min(12, Math.max(1, Number(b.start_month || 1)))
  };
}
async function ensureYear(year) {
  const found = await db.query("SELECT id FROM leave_years WHERE year=$1", [year]);
  if (found.rows.length) return;
  let carry = 0;
  const prev = await db.query("SELECT * FROM leave_years WHERE year=$1", [year - 1]);
  if (prev.rows.length) {
    const ops = await db.query("SELECT * FROM leave_operations WHERE year=$1", [year - 1]);
    const adj = await db.query("SELECT * FROM leave_adjustments WHERE year=$1", [year - 1]);
    carry = calculateYear(prev.rows[0], ops.rows, adj.rows).closingPaid;
  }
  await db.query(
    "INSERT INTO leave_years (year,annual_paid,monthly_paid,annual_sick,initial_paid,initial_sick,sick_carry,planned_forecast,day_mode,start_month) VALUES ($1,22,1.8333,5,$2,5,FALSE,FALSE,'ouvrés',1) ON CONFLICT (year) DO NOTHING",
    [year, carry]
  );
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const year = Number(req.query?.year || new Date().getFullYear());
      await ensureYear(year);
      const [ys, os, ads, logs] = await Promise.all([
        db.query("SELECT * FROM leave_years ORDER BY year DESC"),
        db.query("SELECT * FROM leave_operations ORDER BY start_date DESC,id DESC"),
        db.query("SELECT * FROM leave_adjustments ORDER BY adjustment_date DESC,id DESC"),
        db.query("SELECT * FROM leave_audit_log ORDER BY created_at DESC LIMIT 200")
      ]);
      const config = ys.rows.find(y => Number(y.year) === year);
      const operations = os.rows.filter(o => Number(o.year) === year);
      const adjustments = ads.rows.filter(a => Number(a.year) === year);
      return res.json({ years: ys.rows, operations: os.rows, adjustments: ads.rows, audit: logs.rows,
        selectedYear: year, config, calculation: calculateYear(config, operations, adjustments) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
    const b = req.body || {};
    if (b.action === "save_year") {
      const c = normalizeConfig(b.config || {});
      await db.query(
        `INSERT INTO leave_years (year,annual_paid,monthly_paid,annual_sick,initial_paid,initial_sick,sick_carry,planned_forecast,day_mode,start_month,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         ON CONFLICT (year) DO UPDATE SET annual_paid=EXCLUDED.annual_paid,monthly_paid=EXCLUDED.monthly_paid,
         annual_sick=EXCLUDED.annual_sick,initial_paid=EXCLUDED.initial_paid,initial_sick=EXCLUDED.initial_sick,
         sick_carry=EXCLUDED.sick_carry,planned_forecast=EXCLUDED.planned_forecast,day_mode=EXCLUDED.day_mode,
         start_month=EXCLUDED.start_month,updated_at=now()`,
        [c.year,c.annual_paid,c.monthly_paid,c.annual_sick,c.initial_paid,c.initial_sick,c.sick_carry,c.planned_forecast,c.day_mode,c.start_month]
      );
      await audit("Modification", "Paramètres annuels", c.year, c);
      return res.json({ ok: true });
    }
    if (["create_operation", "update_operation"].includes(b.action)) {
      const o = b.operation || {};
      const year = Number(String(o.start_date || "").slice(0,4));
      if (!o.start_date || !o.end_date || o.end_date < o.start_date) throw new Error("Vérifiez les dates.");
      if (!TYPES.includes(o.leave_type) || !STATUSES.includes(o.status || "validated")) throw new Error("Type ou statut invalide.");
      const days = Number(o.days);
      if (!Number.isFinite(days) || days <= 0 || days > 366) throw new Error("Le nombre de jours doit être positif.");
      const values = [year,o.start_date,o.end_date,o.leave_type,days,String(o.comment || "").slice(0,1000),o.status || "validated"];
      let result;
      if (b.action === "create_operation") {
        result = await db.query("INSERT INTO leave_operations (year,start_date,end_date,leave_type,days,comment,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", values);
        await audit("Création", "Opération", result.rows[0].id, result.rows[0]);
      } else {
        result = await db.query("UPDATE leave_operations SET year=$1,start_date=$2,end_date=$3,leave_type=$4,days=$5,comment=$6,status=$7,updated_at=now() WHERE id=$8 RETURNING *", [...values, Number(o.id)]);
        if (!result.rows.length) throw new Error("Opération introuvable.");
        await audit("Modification", "Opération", o.id, result.rows[0]);
      }
      return res.json({ ok: true, operation: result.rows[0] });
    }
    if (b.action === "delete_operation") {
      const prior = await db.query("SELECT * FROM leave_operations WHERE id=$1", [Number(b.id)]);
      if (!prior.rows.length) throw new Error("Opération introuvable.");
      await db.query("DELETE FROM leave_operations WHERE id=$1", [Number(b.id)]);
      await audit("Suppression", "Opération", b.id, prior.rows[0]);
      return res.json({ ok: true });
    }
    if (b.action === "create_adjustment") {
      const a = b.adjustment || {};
      if (!TYPES.includes(a.leave_type) || !String(a.reason || "").trim()) throw new Error("Type et motif obligatoires.");
      const month = a.month ? Number(a.month) : null;
      if (month !== null && (month < 1 || month > 12)) throw new Error("Mois invalide.");
      const r = await db.query(
        "INSERT INTO leave_adjustments (year,leave_type,month,old_value,new_value,adjustment_date,reason) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [Number(a.year),a.leave_type,month,Number(a.old_value || 0),Number(a.new_value || 0),a.adjustment_date || new Date().toISOString().slice(0,10),String(a.reason).trim().slice(0,500)]
      );
      await audit("Correction", "Solde", r.rows[0].id, r.rows[0]);
      return res.json({ ok: true, adjustment: r.rows[0] });
    }
    if (b.action === "delete_adjustment") {
      const prior = await db.query("SELECT * FROM leave_adjustments WHERE id=$1", [Number(b.id)]);
      if (!prior.rows.length) throw new Error("Correction introuvable.");
      await db.query("DELETE FROM leave_adjustments WHERE id=$1", [Number(b.id)]);
      await audit("Suppression", "Correction", b.id, prior.rows[0]);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: "Action non prise en charge." });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Erreur serveur." });
  }
}
