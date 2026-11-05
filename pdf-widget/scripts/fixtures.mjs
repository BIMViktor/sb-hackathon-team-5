import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
export async function demoPdf(revision) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Ritningsbord - demonstrationsritning");
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.22, 0.29, 0.26),
    light = rgb(0.6, 0.67, 0.62),
    green = rgb(0.16, 0.37, 0.29);
  const sizes =
    revision === 3
      ? [
          [1700, 1100],
          [842, 595],
          [595, 842],
        ]
      : [
          [1190, 842],
          [842, 595],
          [595, 842],
        ];
  for (let i = 0; i < 3; i++) {
    const [w, h] = sizes[i],
      p = pdf.addPage([w, h]);
    const text = (t, x, y, size = 10, color = ink, b = false) =>
      p.drawText(t, { x, y, size, font: b ? bold : font, color });
    const line = (x, y, x2, y2, width = 0.7, color = ink) =>
      p.drawLine({
        start: { x, y },
        end: { x: x2, y: y2 },
        thickness: width,
        color,
      });
    const rect = (x, y, ww, hh, width = 0.8, color = ink) =>
      p.drawRectangle({
        x,
        y,
        width: ww,
        height: hh,
        borderWidth: width,
        borderColor: color,
      });
    rect(25, 25, w - 50, h - 50, 0.8, light);
    text("RITNINGSBORD", 45, h - 52, 11, green, true);
    text("DEMONSTRATION / EJ BYGGHANDLING", w - 290, h - 52, 8, light);
    const x = 125,
      y = 155,
      ww = w - 250,
      hh = h - 280,
      cols = 4,
      rows = 2,
      cw = ww / cols,
      ch = hh / rows;
    rect(x, y, ww, hh, 4);
    for (let c = 1; c < cols; c++) line(x + c * cw, y, x + c * cw, y + hh, 3);
    for (let r = 1; r < rows; r++) line(x, y + r * ch, x + ww, y + r * ch, 3);
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const rx = x + c * cw,
          ry = y + r * ch,
          names = [
            "KONTOR",
            "MOTESRUM",
            "PAUS",
            "KORRIDOR",
            "KONTOR",
            "TEKNIK",
            "ENTRE",
            "KONTOR",
          ];
        text(names[r * 4 + c], rx + 16, ry + ch * 0.6, 10, ink, true);
        text(
          `${101 + r * 4 + c}   ${((cw * ch) / 240).toFixed(1)} m2`,
          rx + 16,
          ry + ch * 0.6 - 18,
          9,
          light,
        );
        if (c < 3) {
          p.drawRectangle({
            x: rx + cw - 3,
            y: ry + 20,
            width: 6,
            height: 30,
            color: rgb(1, 1, 1),
          });
          line(rx + cw, ry + 20, rx + cw - 29, ry + 20);
        }
        for (let n = 0; n < 2; n++) {
          rect(rx + 25 + n * 45, ry + 35, 34, 18, 0.6, light);
          rect(rx + 35 + n * 45, ry + 27, 13, 6, 0.5, light);
        }
      }
    for (let c = 0; c <= cols; c++) {
      const gx = x + c * cw;
      line(gx, 100, gx, h - 80, 0.35, light);
      p.drawCircle({
        x: gx,
        y: h - 84,
        size: 9,
        borderWidth: 0.6,
        borderColor: light,
      });
      text(String.fromCharCode(65 + c), gx - 3, h - 87, 8);
      line(gx, y - 27, gx, y - 43, 0.4, light);
      if (c < cols) {
        line(gx, y - 35, gx + cw, y - 35, 0.5, light);
        text("6 000", gx + cw / 2 - 12, y - 31, 7, light);
      }
    }
    for (let r = 0; r <= rows; r++) {
      const gy = y + r * ch;
      line(80, gy, w - 80, gy, 0.35, light);
      p.drawCircle({
        x: 85,
        y: gy,
        size: 9,
        borderWidth: 0.6,
        borderColor: light,
      });
      text(String(r + 1), 82, gy - 3, 8);
    }
    if (revision === 2) {
      rect(x + ww * 0.5 + 20, y + hh * 0.55, 65, 30, 1.2, green);
      text("NY INREDNING", x + ww * 0.5 + 20, y + hh * 0.55 + 38, 7, green);
    }
    rect(w - 355, 25, 330, 68, 0.7);
    line(w - 355, 53, w - 25, 53, 0.5);
    text(
      revision === 3 ? "K-20.4-001" : "A-40.1-100",
      w - 340,
      72,
      16,
      ink,
      true,
    );
    text(
      i === 0
        ? "PLAN 1 - KONTOR"
        : i === 1
          ? "PLAN 2 - ROTERAD SIDA"
          : "DETALJ - BESKUREN SIDA",
      45,
      60,
      11,
      ink,
      true,
    );
    text(
      `REV ${revision === 2 ? "B" : "A"}   |   SKALA 1:100   |   SIDA ${i + 1}/3`,
      w - 340,
      37,
      8,
    );
    text("Testpunkt: rutnat C/2", 45, 42, 8, light);
    if (i === 1) p.setRotation(degrees(90));
    if (i === 2) p.setCropBox(40, 50, w - 80, h - 100);
  }
  return new Uint8Array(await pdf.save());
}
