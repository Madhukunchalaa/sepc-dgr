import pandas as pd
import json

excel_file = r'c:\Users\IE-Admin\Desktop\dgr\dgr-platform\TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx'
try:
    # Read the DGR sheet
    df = pd.read_excel(excel_file, sheet_name='DGR', header=None)
    
    # Save first 60 rows and 10 columns for analysis
    subset = df.iloc[0:65, 0:10]
    
    # Print as a formatted table or save to file
    print("--- TAQA DGR Excel Structure (First 65 rows) ---")
    for index, row in subset.iterrows():
        # Clean up row for printing
        clean_row = [str(x).strip() if pd.notnull(x) else "" for x in row]
        print(f"Row {index+1:2}: {' | '.join(clean_row)}")
        
except Exception as e:
    print(f"Error reading Excel: {e}")
