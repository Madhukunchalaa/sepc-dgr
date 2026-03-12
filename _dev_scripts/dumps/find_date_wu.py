import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR (WU)']

print(f"Sheet: {sheet.title}")
for r in range(1, 31):
    for c in range(1, 15):
        val = sheet.cell(row=r, column=c).value
        if isinstance(val, (datetime.datetime, datetime.date)):
            print(f"Row {r} Col {c} has date: {val}")
