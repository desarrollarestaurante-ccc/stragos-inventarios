"""Genera el Excel de prueba de ventas POS con cortesías y promociones (y su CSV)."""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
HEAD = ["fecha", "codigo_pos", "cantidad", "tipo", "precio_unit_con_igv", "detalle"]
HH, BALDE, PS = "Happy hour Chilcano 2x1", "Balde de cervezas 5x40", "Pisco sour 2x1"
ROWS = []
def v(d, c, q): ROWS.append([d, c, q, "venta", "", ""])
def p(d, c, q, pr, name): ROWS.append([d, c, q, "promo", pr, name])
def k(d, c, q, why): ROWS.append([d, c, q, "cortesia", 0, why])

d = "2026-11-06"
for c, q in [("P001",6),("P002",8),("P003",3),("P004",8),("P005",2),("P006",5),("P007",5),("P008",4),("P999",2)]: v(d, c, q)
p(d, "P007", 4, 10, HH); k(d, "P002", 1, "Cumpleaños")
d = "2026-11-13"
for c, q in [("P001",7),("P002",9),("P003",2),("P004",7),("P005",1),("P006",6),("P007",6),("P008",5)]: v(d, c, q)
p(d, "P007", 6, 10, HH); p(d, "P004", 5, 8, BALDE); k(d, "P008", 2, "Cliente frecuente"); k(d, "P006", 1, "Compensación por demora")
d = "2026-11-20"
for c, q in [("P001",8),("P002",10),("P003",4),("P004",8),("P005",2),("P006",7),("P007",6),("P008",6),("P999",1)]: v(d, c, q)
p(d, "P002", 4, 11, PS); p(d, "P004", 5, 8, BALDE); p(d, "P007", 4, 10, HH)
k(d, "P001", 2, "Cumpleaños"); k(d, "P002", 1, "Invitación de gerencia"); k(d, "P005", 1, "Compensación por demora"); k(d, "P008", 1, "Cliente frecuente")

wb = Workbook()
ws = wb.active; ws.title = "ventas"
ws.append(HEAD)
for r in ROWS: ws.append(r)
hdr = PatternFill("solid", fgColor="111010")
for c in ws[1]:
    c.font = Font(bold=True, color="F29D1F"); c.fill = hdr; c.alignment = Alignment(horizontal="center")
for row in ws.iter_rows(min_row=2):
    row[0].number_format = "@"   # la fecha va como texto AAAA-MM-DD
    t = row[3].value
    if t == "cortesia": row[3].font = Font(color="B45309", bold=True)
    elif t == "promo": row[3].font = Font(color="1F8A5A", bold=True)
for i, w in enumerate([13, 12, 10, 11, 20, 28], 1): ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = "A2"

info = wb.create_sheet("Instrucciones")
lines = [
    "Ventas de prueba · Stragos Ucello (datos ficticios)",
    "",
    "Cómo usarlo: en el sistema entra con ccastillo o jdiego → Ventas POS → «Elegir archivo…» y elige este Excel.",
    "",
    "Columnas",
    "fecha: AAAA-MM-DD como texto (06, 13 y 20 de noviembre de 2026).",
    "codigo_pos: código del producto en la carta (P001 a P008). P999 no tiene receta y sale como advertencia.",
    "cantidad: unidades vendidas.",
    "tipo: venta (precio de carta), promo (precio cobrado en precio_unit_con_igv) o cortesia (sin cobro).",
    "precio_unit_con_igv: solo para promociones. En venta se toma el precio de la carta; en cortesía es 0.",
    "detalle: nombre de la promoción o motivo de la cortesía (cumpleaños, cliente frecuente, compensación por demora, invitación de gerencia).",
    "",
    "Qué vas a ver",
    f"{sum(1 for r in ROWS if r[3]=='venta')} filas de venta, {sum(1 for r in ROWS if r[3]=='promo')} de promoción y {sum(1 for r in ROWS if r[3]=='cortesia')} de cortesía.",
    "Las cortesías descuentan insumos pero no suman venta: aparecen en «Mermas y cortesías» contra su objetivo.",
    "Las promociones alimentan el gráfico de impacto en el food cost del dashboard.",
]
for l in lines: info.append([l])
info["A1"].font = Font(bold=True, size=13); info["A5"].font = Font(bold=True); info["A13"].font = Font(bold=True)
info.column_dimensions["A"].width = 120

xlsx = os.path.join(HERE, "ventas-prueba-con-cortesias.xlsx")
wb.save(xlsx)
with open(os.path.join(HERE, "ventas-prueba-con-cortesias.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(HEAD); w.writerows(ROWS)
print(xlsx, len(ROWS), "filas")
