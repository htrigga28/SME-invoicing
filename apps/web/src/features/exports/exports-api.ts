import { apiDownload } from "@/lib/api";

export type ExportDataset = "audit-logs" | "customers" | "invoices" | "payments" | "receipts";

export type ExportFilters = Record<string, string | undefined>;

export async function downloadExportCsv(
  accessToken: string,
  dataset: ExportDataset,
  filters: ExportFilters = {}
) {
  const response = await apiDownload(`/exports/${dataset}.csv${toQueryString(filters)}`, {
    accessToken
  });

  triggerBrowserDownload(response.blob, response.filename ?? `${dataset}.csv`);
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toQueryString(input: ExportFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
