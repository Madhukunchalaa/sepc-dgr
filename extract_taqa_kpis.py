import openpyxl

excel_file = r'c:\Users\IE-Admin\Desktop\dgr\dgr-platform\TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
wb = openpyxl.load_workbook(excel_file, data_only=True)
ws = wb['DGR']

keywords = [
    "Rated Capacity", "Declared Capacity", "Dispatch Demand", "Schedule Generation",
    "Gross Generation", "Deemed Generation", "Auxiliary Consumption", "Net Import", "Net Export",
    "Auxiliary Power Consumption (APC)", "Plant Availability Factor (PAF)", "Plant Load Factor (PLF)",
    "Unit trip", "Unit On Grid", "HFO Consumption", "HFO Stock", "Sp Oil Consumption",
    "Lignite Consumption", "Lignite Stock", "Sp Lignite Consumption", "GCV (As Fired)", "GHR (As Fired)",
    "DM water Production", "DM Water Consumption", "Ash Generation", "Fly ash Quantity to cement plant"
]

print(f"{'Particulars':<40} | {'UoM':<10} | {'Daily':<10} | {'MTD':<10} | {'YTD':<10}")
print("-" * 90)

for row in ws.iter_rows(min_row=1, max_row=150):
    particulars = str(row[2].value).strip() if row[2].value else ""
    if any(k.lower() in particulars.lower() for k in keywords):
        uom = str(row[3].value).strip() if row[3].value else ""
        daily = row[4].value
        mtd = row[5].value
        ytd = row[6].value
        
        # Format numbers
        d_str = f"{daily:.3f}" if isinstance(daily, (int, float)) else str(daily)
        m_str = f"{mtd:.3f}" if isinstance(mtd, (int, float)) else str(mtd)
        y_str = f"{ytd:.3f}" if isinstance(ytd, (int, float)) else str(ytd)
        
        print(f"{particulars:<40} | {uom:<10} | {d_str:<10} | {m_str:<10} | {y_str:<10}")
