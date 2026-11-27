"""Genera la plantilla de Google Sheets (Cabecera y Detalle) y un JSON de ejemplo para Make."""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

HERE = os.path.dirname(os.path.abspath(__file__))
CAB = ["id_envio", "tipo", "tienda", "punto", "responsable", "enviado_por", "rol", "fecha", "hora", "total_items", "enviado_en"]
DET = ["id_envio", "linea", "tipo", "punto", "sku", "insumo", "categoria", "unidad", "apertura", "recibido", "enviado",
       "consumo_recetas", "mermas", "saldo_teorico", "cantidad_contada", "diferencia", "costo_unitario", "valor"]

wb = Workbook()
for i, (name, cols) in enumerate([("Cabecera", CAB), ("Detalle", DET)]):
    ws = wb.active if i == 0 else wb.create_sheet()
    ws.title = name
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True, color="F29D1F"); c.fill = PatternFill("solid", fgColor="111010"); c.alignment = Alignment(horizontal="center")
    for j, col in enumerate(cols, 1):
        ws.column_dimensions[ws.cell(1, j).column_letter].width = max(12, len(col) + 4)
    ws.freeze_panes = "A2"
wb.save(os.path.join(HERE, "plantilla-BD-stragos.xlsx"))

ejemplo = {
    "origen": "stragos-inventarios", "version": 7, "id_envio": "ENV-20261120-221530-barra", "tipo": "inventario_diario",
    "cabecera": {"id_envio": "ENV-20261120-221530-barra", "tipo": "Inventario diario", "tienda": "Stragos Ucello · San Borja",
                 "punto": "Barra principal", "responsable": "Equipo de barra", "enviado_por": "Equipo de barra",
                 "rol": "Operario de barra/cocina", "fecha": "2026-11-20", "hora": "22:15:30", "total_items": 2,
                 "enviado_en": "2026-11-21T03:15:30.000Z"},
    "detalle": [
        {"id_envio": "ENV-20261120-221530-barra", "linea": 1, "tipo": "inventario_diario", "punto": "Barra principal", "sku": "LIC-002",
         "insumo": "Pisco quebranta 700 ml", "categoria": "Licores", "unidad": "bot", "apertura": 8, "recibido": 0, "enviado": 0,
         "consumo_recetas": "", "mermas": 0, "saldo_teorico": "", "cantidad_contada": 6.25, "diferencia": "", "costo_unitario": "", "valor": ""},
        {"id_envio": "ENV-20261120-221530-barra", "linea": 2, "tipo": "inventario_diario", "punto": "Barra principal", "sku": "VIN-001",
         "insumo": "Vino tinto 750 ml", "categoria": "Licores", "unidad": "bot", "apertura": 6, "recibido": 0, "enviado": 0,
         "consumo_recetas": "", "mermas": 0, "saldo_teorico": "", "cantidad_contada": 4.4, "diferencia": "", "costo_unitario": "", "valor": ""}
    ]
}
json.dump(ejemplo, open(os.path.join(HERE, "ejemplo-envio.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok")
