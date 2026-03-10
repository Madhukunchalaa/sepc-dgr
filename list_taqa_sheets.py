import pandas as pd
excel_file = r'c:\Users\IE-Admin\Desktop\dgr\dgr-platform\TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
xls = pd.ExcelFile(excel_file)
print("Sheet Names:")
print(xls.sheet_names)
