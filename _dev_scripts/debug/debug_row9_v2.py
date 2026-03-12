import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR']

print(f"Sheet Name: {sheet.title}")
print("Row 9 (Col 1-20):")
for c in range(1, 21):
    val = sheet.cell(row=9, column=c).value
    print(f"Col {c}: {val} | Type: {type(val)}")
