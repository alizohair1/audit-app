export type UserRole = "admin" | "auditor" | "branch" | "utility_admin";
export type ScoringType = "score" | "time";
export type SosBand = "Green" | "Blue" | "Orange" | "Grey" | "Red";

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  branch_id: string | null;
  created_at: string;
  email?: string; // joined in from auth.users when needed
}

export interface BranchMeter {
  id: string;
  branch_id: string;
  meter_number: string;
  label: string | null;
  created_at: string;
}

export interface JobType {
  id: string;
  name: string;
  scoring_type: ScoringType;
  std_score: number | null;
  report_ref: string | null;
  sort_order: number;
  created_at: string;
}

export interface AuditorBranchAssignment {
  id: string;
  auditor_id: string;
  branch_id: string;
  created_at: string;
}

export interface AuditSubmission {
  id: string;
  auditor_id: string;
  branch_id: string;
  job_type_id: string;
  date: string;
  obtained_score: number | null;
  std_score_used: number | null;
  time_taken_seconds: number | null;
  percentage: number | null;
  band: SosBand | null;
  report_link: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface ElectricityReading {
  id: string;
  branch_id: string;
  meter_id: string;
  date: string;
  reading: number;
  submitted_by: string;
  submitted_at: string;
}

export interface DieselPurchase {
  id: string;
  branch_id: string;
  date: string;
  amount: number | null;
  litres: number | null;
  submitted_by: string;
  submitted_at: string;
}

export interface GensetReading {
  id: string;
  branch_id: string;
  date: string;
  dip_stick_measure: number | null;
  fuel_tank_fill_pct: number | null;
  external_tank: number | null;
  submitted_by: string;
  submitted_at: string;
}