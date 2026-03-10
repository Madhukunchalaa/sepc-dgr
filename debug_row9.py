import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR']

print("First 100 columns of Row 9:")
for col in range(1, 101):
    val = sheet.cell(row=9, column=col).value
    if val:
        print(f"Col {col}: {val} ({type(val)})")
