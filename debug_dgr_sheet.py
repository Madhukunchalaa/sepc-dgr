import openpyxl
file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR']

print(f"Sheet: {sheet.title}")
for r in range(1, 15):
    row_vals = [sheet.cell(row=r, column=c).value for c in range(1, 10)]
    print(f"Row {r}: {row_vals}")
