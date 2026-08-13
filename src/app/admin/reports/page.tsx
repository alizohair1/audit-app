import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { ADMIN_NAV } from "@/lib/nav";
import AuditReportDashboard from "@/components/reports/AuditReportDashboard";

export default function AdminReportsPage() {
  return (
    <div>
      <Navbar title="Admin" />
      <SubNav items={ADMIN_NAV} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AuditReportDashboard
          mode="admin"
          title="Audit Reports"
          subtitle="Scores, trends, and details across all branches and auditors."
        />
      </main>
    </div>
  );
}