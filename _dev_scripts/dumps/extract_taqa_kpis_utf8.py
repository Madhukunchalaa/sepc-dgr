import openpyxl
import io

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

output = io.StringIO()
output.write(f"{'Particulars':<40} | {'UoM':<10} | {'Daily':<15} | {'MTD':<15} | {'YTD':<15}\n")
output.write("-" * 110 + "\n")

for row_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=150), 1):
    particulars = str(row[2].value).strip() if row[2].value else ""
    if any(k.lower() in particulars.lower() for k in keywords):
        uom = str(row[3].value).strip() if row[3].value else ""
        daily = row[4].value
        mtd = row[5].value
        ytd = row[6].value
        
        d_str = f"{daily:.4f}" if isinstance(daily, (int, float)) else str(daily)
        m_str = f"{mtd:.4f}" if isinstance(mtd, (int, float)) else str(mtd)
        y_str = f"{ytd:.4f}" if isinstance(ytd, (int, float)) else str(ytd)
        
        output.write(f"R{row_idx:3}: {particulars:<40} | {uom:<10} | {d_str:<15} | {m_str:<15} | {y_str:<15}\n")

with open('taqa_kpi_utf8.txt', 'w', encoding='utf-8') as f:
    f.write(output.getvalue())

print("Extraction complete. Saved to taqa_kpi_utf8.txt")
