"use client";

import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import AuditReportDashboard from "@/components/reports/AuditReportDashboard";
import { AUDITOR_NAV } from "@/lib/nav";

export default function AuditorReportsPage() {
  return (
    <div>
      <Navbar title="Auditor" />
      <SubNav items={AUDITOR_NAV} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AuditReportDashboard
          mode="auditor"
          subtitle="Your submissions only. Filter by branch, job, and date range."
        />
      </main>
    </div>
  );
}
