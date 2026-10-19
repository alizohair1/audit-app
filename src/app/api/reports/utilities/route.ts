import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/supabase/guards";
import { localDateStr } from "@/lib/dates";
import { formatGensetMeter } from "@/lib/genset";

export async function GET(req: NextRequest) {
  const profile = await getMyProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "utility_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createClient(); // admin RLS policies grant full access

  let elecQuery = supabase
    .from("electricity_readings")
    .select("date, reading, branch:branches(name), meter:branch_meters(meter_number)")
    .order("date", { ascending: false });
  let dieselQuery = supabase
    .from("diesel_purchases")
    .select("date, amount, litres, branch:branches(name)")
    .order("date", { ascending: false });
  let gensetQuery = supabase
    .from("genset_readings")
    .select("date, dip_stick_measure, fuel_tank_fill_pct, external_tank, genset_meter_minutes, branch:branches(name)")
    .order("date", { ascending: false });

  if (branchId) {
    elecQuery = elecQuery.eq("branch_id", branchId);
    dieselQuery = dieselQuery.eq("branch_id", branchId);
    gensetQuery = gensetQuery.eq("branch_id", branchId);
  }
  if (from) {
    elecQuery = elecQuery.gte("date", from);
    dieselQuery = dieselQuery.gte("date", from);
    gensetQuery = gensetQuery.gte("date", from);
  }
  if (to) {
    elecQuery = elecQuery.lte("date", to);
    dieselQuery = dieselQuery.lte("date", to);
    gensetQuery = gensetQuery.lte("date", to);
  }

  const [{ data: elec }, { data: diesel }, { data: genset }] = await Promise.all([elecQuery, dieselQuery, gensetQuery]);

  const workbook = new ExcelJS.Workbook();

  const elecSheet = workbook.addWorksheet("Electricity");
  elecSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Meter", key: "meter", width: 18 },
    { header: "Reading", key: "reading", width: 14 },
  ];
  elecSheet.getRow(1).font = { bold: true };
  (elec as any[])?.forEach((r) =>
    elecSheet.addRow({ date: r.date, branch: r.branch?.name, meter: r.meter?.meter_number, reading: r.reading })
  );

  const dieselSheet = workbook.addWorksheet("Diesel Purchases");
  dieselSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Litres (L)", key: "litres", width: 14 },
  ];
  dieselSheet.getRow(1).font = { bold: true };
  (diesel as any[])?.forEach((r) => dieselSheet.addRow({ date: r.date, branch: r.branch?.name, amount: r.amount, litres: r.litres }));

  const gensetSheet = workbook.addWorksheet("Genset");
  gensetSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Dip Stick Measure (m)", key: "dip", width: 22 },
    { header: "Fuel Tank Fill (%)", key: "fuel", width: 18 },
    { header: "Digital Genset Meter", key: "meter", width: 22 },
    { header: "External Tank (m)", key: "ext", width: 18 },
  ];
  gensetSheet.getRow(1).font = { bold: true };
  (genset as any[])?.forEach((r) =>
    gensetSheet.addRow({
      date: r.date,
      branch: r.branch?.name,
      dip: r.dip_stick_measure,
      fuel: r.fuel_tank_fill_pct,
      meter: formatGensetMeter(r.genset_meter_minutes),
      ext: r.external_tank,
    })
  );

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="utilities-report-${localDateStr()}.xlsx"`,
    },
  });
}
