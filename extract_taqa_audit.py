import pandas as pd
import datetime

file_path = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
target_dates = ['2025-07-15', '2025-11-23', '2025-04-09']

def get_excel_data(dates):
    # Load DGR sheet
    df = pd.read_excel(file_path, sheet_name='DGR', header=None)
    
    # Dates are usually in row 6 (index 5) or similar
    # Let's find the row that contains dates
    date_row_idx = -1
    for i, row in df.iterrows():
        for j, val in enumerate(row):
            if isinstance(val, (datetime.datetime, pd.Timestamp)):
                date_row_idx = i
                break
        if date_row_idx != -1:
            break
            
    if date_row_idx == -1:
        print("Could not find date row")
        return

    # Map dates to columns
    date_cols = {}
    for j, val in enumerate(df.iloc[date_row_idx]):
        if isinstance(val, (datetime.datetime, pd.Timestamp)):
            d_str = val.strftime('%Y-%m-%d')
            if d_str in dates:
                date_cols[d_str] = j

    print(f"Found dates in columns: {date_cols}")
    
    # Extract KPIs
    # KPIs are in column B (index 1), UoM in C (index 2)
    # Values for Daily in the date column, MTD in date+1, YTD in date+2 usually? 
    # Or is it a single column per date and MTD/YTD are elsewhere?
    # Usually in these sheets, it's one column per day for 'Daily'.
    
    results = {}
    for d_str, col_idx in date_cols.items():
        day_data = []
        for i in range(date_row_idx + 1, len(df)):
            particulars = str(df.iloc[i, 1])
            uom = str(df.iloc[i, 2])
            daily = df.iloc[i, col_idx]
            # MTD and YTD might be in static columns or calculated.
            # For audit, let's just get the Daily values first.
            if particulars and particulars != 'nan' and particulars.strip():
                day_data.append({
                    'row': i + 1,
                    'particulars': particulars.strip(),
                    'uom': uom.strip(),
                    'daily': daily
                })
        results[d_str] = day_data
        
    return results

results = get_excel_data(target_dates)
if results:
    for date, data in results.items():
        print(f"\n--- {date} ---")
        for item in data[:20]: # Print first 20 for brevity
            print(f"{item['particulars']} ({item['uom']}): {item['daily']}")
