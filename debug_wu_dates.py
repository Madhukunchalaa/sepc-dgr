import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR (WU)']

print(f"Sheet: {sheet.title}")
date_info = []
for c in range(1, 1001):
    val = sheet.cell(row=2, column=c).value
    if val:
        date_info.append((c, val))

for c, v in date_info[:50]:
    print(f"Col {c}: {v}")
