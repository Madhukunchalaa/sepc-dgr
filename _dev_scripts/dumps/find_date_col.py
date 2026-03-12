import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR']

print(f"Sheet: {sheet.title}")
# Scan columns 1-15 for dates
for c in range(1, 16):
    for r in range(1, 501):
        val = sheet.cell(row=r, column=c).value
        if isinstance(val, (datetime.datetime, datetime.date)):
             print(f"Col {c} Row {r} has date: {val}")
             # Print just first 10 dates per column
             if r > 50: break 
