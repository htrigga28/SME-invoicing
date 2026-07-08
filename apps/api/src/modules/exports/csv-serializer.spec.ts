import { formatKoboDecimal } from "./export-format";
import { serializeCsv } from "./csv-serializer";

describe("CSV export helpers", () => {
  it("serializes valid CSV with deterministic columns and spreadsheet injection protection", () => {
    const csv = serializeCsv(
      [
        { header: "name", value: (row: { name: string }) => row.name },
        {
          header: "amount_ngn",
          value: (row: { amountKobo: number }) => formatKoboDecimal(row.amountKobo)
        }
      ],
      [
        { name: "Akin & Co", amountKobo: 170000 },
        { name: "Smith, Jones & Co", amountKobo: 0 },
        { name: 'The "Best" Company', amountKobo: 105 },
        { name: "Line one\nLine two", amountKobo: 100 },
        { name: "=SUM(A1:A2)", amountKobo: 100 },
        { name: "+cmd|' /C calc'!A0", amountKobo: 100 },
        { name: "@malicious", amountKobo: 100 },
        { name: "   =hidden", amountKobo: 100 },
        { name: "Ọlá Consulting", amountKobo: 12345 }
      ],
      { includeBom: false }
    );

    expect(csv).toContain("name,amount_ngn\r\n");
    expect(csv).toContain("Akin & Co,1700.00\r\n");
    expect(csv).toContain('"Smith, Jones & Co",0.00\r\n');
    expect(csv).toContain('"The ""Best"" Company",1.05\r\n');
    expect(csv).toContain('"Line one\nLine two",1.00\r\n');
    expect(csv).toContain("'=SUM(A1:A2),1.00\r\n");
    expect(csv).toContain("'+cmd|' /C calc'!A0,1.00\r\n");
    expect(csv).toContain("'@malicious,1.00\r\n");
    expect(csv).toContain("'   =hidden,1.00\r\n");
    expect(csv).toContain("Ọlá Consulting,123.45\r\n");
  });

  it("formats kobo as exact decimal NGN strings without floating point math", () => {
    expect(formatKoboDecimal(0)).toBe("0.00");
    expect(formatKoboDecimal(1)).toBe("0.01");
    expect(formatKoboDecimal(170000)).toBe("1700.00");
    expect(formatKoboDecimal(-105)).toBe("-1.05");
  });
});
