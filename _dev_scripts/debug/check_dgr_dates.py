import openpyxl
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5 v1.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['DGR']

dates = []
for c in range(5, 500):
    val = sheet.cell(row=9, column=c).value
    if isinstance(val, (datetime.datetime, datetime.date)):
        dates.append((c, val))

print(f"Total dates found: {len(dates)}")
if dates:
    print(f"Starts at Col {dates[0][0]}: {dates[0][1]}")
    print(f"Ends at Col {dates[-1][0]}: {dates[-1][1]}")
