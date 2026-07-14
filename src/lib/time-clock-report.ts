export type TimeClockReportRow = {
  employeeId: string;
  employeeName: string;
  date: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
};

function csvValue(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildTimeClockReportCsv(rows: TimeClockReportRow[]) {
  const header = [
    "Employee ID",
    "Empleado",
    "Fecha",
    "Horas regulares",
    "Horas extra",
    "Horas totales",
  ];
  const body = rows.map((row) => [
    row.employeeId,
    row.employeeName,
    row.date,
    row.regularHours.toFixed(2),
    row.overtimeHours.toFixed(2),
    row.totalHours.toFixed(2),
  ]);
  return [header, ...body].map((row) => row.map(csvValue).join(",")).join("\n");
}
