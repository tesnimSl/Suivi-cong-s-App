export function calculateYear(config, operations = [], adjustments = []) {
  const year = Number(config.year);
  const names = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const included = operations.filter(o =>
    Number(o.year) === year && o.status !== "cancelled" &&
    (o.status === "validated" || config.planned_forecast)
  );
  let paid = Number(config.initial_paid || 0);
  let sick = Number(config.sick_carry ? config.initial_sick : config.annual_sick);
  let paidTakenTotal = 0, sickTakenTotal = 0, earnedTotal = 0;
  const months = names.map((name, i) => {
    const month = i + 1;
    const ops = included.filter(o => {
      const sm = Number(String(o.start_date).slice(5,7));
      const em = Number(String(o.end_date).slice(5,7));
      const sy = Number(String(o.start_date).slice(0,4));
      const ey = Number(String(o.end_date).slice(0,4));
      return (sy === ey && sm === month) || (sy !== ey && month >= sm && month <= em);
    });
    const paidTaken = ops.filter(o => o.leave_type === "paid").reduce((s,o) => s + Number(o.days), 0);
    const sickTaken = ops.filter(o => o.leave_type === "sick").reduce((s,o) => s + Number(o.days), 0);
    const delta = type => adjustments.filter(a => a.leave_type === type && Number(a.month || 0) === month)
      .reduce((s,a) => s + Number(a.new_value) - Number(a.old_value), 0);
    const openingPaid = paid;
    const monthlyCredit = Number(config.monthly_paid);
    paid = Math.round((paid + monthlyCredit + delta("paid") - paidTaken + Number.EPSILON) * 10000) / 10000;
    sick = Math.round((sick + delta("sick") - sickTaken + Number.EPSILON) * 10000) / 10000;
    paidTakenTotal += paidTaken; sickTakenTotal += sickTaken; earnedTotal += monthlyCredit;
    return { month, name, openingPaid, monthlyCredit, paidTaken, closingPaid: paid,
      sickCredit: Number(config.annual_sick), sickTaken, sickBalance: sick, comment: "" };
  });
  return { year, months, initialPaid: Number(config.initial_paid || 0), earnedTotal,
    paidTakenTotal, closingPaid: paid, annualSick: Number(config.annual_sick),
    initialSick: Number(config.sick_carry ? config.initial_sick : config.annual_sick),
    sickTakenTotal, sickRemaining: sick };
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
