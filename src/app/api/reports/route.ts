import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/supabase/guards";
import { secondsToHms } from "@/lib/scoring";
import { localDateStr } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const profile = await getMyProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "auditor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const jobTypeId = searchParams.get("jobTypeId");
  const auditorId = searchParams.get("auditorId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createClient(); // RLS scopes: admin sees all, auditor sees only their own rows

  let query = supabase
    .from("audit_submissions")
    .select(
      "date, obtained_score, std_score_used, time_taken_seconds, percentage, band, report_link, submitted_at, branch:branches(name), job_type:job_types(name, std_score, scoring_type), auditor:profiles!audit_submissions_auditor_id_fkey(full_name)"
    )
    .order("date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (jobTypeId) query = query.eq("job_type_id", jobTypeId);
  if (auditorId && profile.role === "admin") query = query.eq("auditor_id", auditorId);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit Report");

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Job", key: "job", width: 22 },
    { header: "Std Score", key: "std", width: 10 },
    { header: "Obtained / Time", key: "obtained", width: 16 },
    { header: "Percentage", key: "percentage", width: 12 },
    { header: "Band (SOS)", key: "band", width: 12 },
    { header: "Report Link", key: "link", width: 30 },
    { header: "Auditor", key: "auditor", width: 20 },
    { header: "Submitted At", key: "submittedAt", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  (data as any[])?.forEach((row) => {
    sheet.addRow({
      date: row.date,
      branch: row.branch?.name ?? "",
      job: row.job_type?.name ?? "",
      std: row.job_type?.scoring_type === "score" ? row.std_score_used ?? row.job_type?.std_score : "",
      obtained:
        row.job_type?.scoring_type === "score"
          ? row.obtained_score
          : row.time_taken_seconds != null
          ? secondsToHms(row.time_taken_seconds)
          : "",
      percentage: row.percentage != null ? `${row.percentage}%` : "",
      band: row.band ?? "",
      link: row.report_link ?? "",
      auditor: row.auditor?.full_name ?? "",
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="audit-report-${localDateStr()}.xlsx"`,
    },
  });
}