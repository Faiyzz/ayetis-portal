export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toSpreadsheetMl(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const headerCells = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('');
  const body = rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const text = cell == null ? '' : String(cell);
          const numeric = text !== '' && /^-?\d+(\.\d+)?$/.test(text);
          return numeric
            ? `<Cell><Data ss:Type="Number">${escapeXml(text)}</Data></Cell>`
            : `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function toPrintHtml(input: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}): string {
  const head = input.headers.map((h) => `<th>${escapeXml(h)}</th>`).join('');
  const body = input.rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeXml(c == null ? '' : String(c))}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeXml(input.title)}</title>
<style>
  body{font-family:Georgia,serif;color:#111;margin:24px;line-height:1.4}
  h1{font-size:22px;margin:0 0 8px}
  .muted{color:#555;font-size:13px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:16px}
  th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#f4f4f4}
  @media print{button{display:none} body{margin:8px}}
</style></head><body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>${escapeXml(input.title)}</h1>
  ${input.subtitle ? `<p class="muted">${escapeXml(input.subtitle)}</p>` : ''}
  <table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="99">No rows</td></tr>'}</tbody></table>
</body></html>`;
}
