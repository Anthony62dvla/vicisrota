import { staffImportTemplate } from "@vicisrota/compliance";

/** The staff import template: the headings and one example row, ready to open in a spreadsheet. */
export function GET() {
  return new Response(staffImportTemplate(), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="vicisrota-staff-template.csv"' },
  });
}
