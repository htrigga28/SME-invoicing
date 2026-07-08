export type CsvCellValue = Date | number | string | null | undefined;

export type CsvColumn<TRow> = {
  header: string;
  value: (row: TRow) => CsvCellValue;
};

type CsvOptions = {
  includeBom?: boolean;
  lineEnding?: "\n" | "\r\n";
};

const dangerousSpreadsheetPrefix = /^[\s]*[=+\-@*]/;

export function serializeCsv<TRow>(
  columns: CsvColumn<TRow>[],
  rows: TRow[],
  options: CsvOptions = {}
) {
  const lineEnding = options.lineEnding ?? "\r\n";
  const includeBom = options.includeBom ?? true;
  const records = [
    columns.map((column) => escapeCsvCell(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCsvCell(toCellString(column.value(row)))).join(",")
    )
  ];

  return `${includeBom ? "\uFEFF" : ""}${records.join(lineEnding)}${lineEnding}`;
}

export function sanitizeSpreadsheetCell(value: string) {
  if (!dangerousSpreadsheetPrefix.test(value)) {
    return value;
  }

  return `'${value}`;
}

function escapeCsvCell(value: string) {
  const sanitized = sanitizeSpreadsheetCell(value);

  if (!/[",\r\n]/.test(sanitized)) {
    return sanitized;
  }

  return `"${sanitized.replaceAll('"', '""')}"`;
}

function toCellString(value: CsvCellValue) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}
