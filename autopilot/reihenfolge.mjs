// Reihenfolge: Posts mit Ablaufdatum („bis“, Trend oder Anlass) zuerst, das früheste Ende vorne, dann alle anderen; jeweils ältestes zuerst.
// Sonst käme ein Trend-Post, der hinten an eine volle Warteschlange gehängt wird, erst nach seinem Ende dran.
export const bisVon = (body) => (body.match(/"bis"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
export function reihenfolge(a, b) {
  const x = bisVon(a.body), y = bisVon(b.body);
  if (x && y && x !== y) return x.localeCompare(y);
  if (!!x !== !!y) return x ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}
