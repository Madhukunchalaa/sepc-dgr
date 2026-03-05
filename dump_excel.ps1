$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("C:\Users\IE-Admin\Desktop\dgr\dgr-platform\DGR FY 2025-20261 - V1 (1).xlsx")
$ws = $wb.Sheets.Item("DGR")

$dates = @(45792, 45820, 45866) # 2025-05-15, 2025-06-12, 2025-07-28

$results = @{}

foreach ($d in $dates) {
    $ws.Range("D4").Value = $d
    $excel.CalculateFull()
    
    $rows = @()
    for ($r = 6; $r -le 100; $r++) {
        $sn = $ws.Cells.Item($r, 1).Value()
        $part = $ws.Cells.Item($r, 2).Value()
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        
        $daily = $ws.Cells.Item($r, 4).Value()
        $mtd = $ws.Cells.Item($r, 5).Value()
        $ytd = $ws.Cells.Item($r, 6).Value()
        
        $rows += @{
            sn = $sn
            particulars = $part
            daily = $daily
            mtd = $mtd
            ytd = $ytd
        }
    }
    $results[$d.ToString()] = $rows
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$results | ConvertTo-Json -Depth 5 | Out-File "C:\Users\IE-Admin\Desktop\dgr\dgr-platform\excel_dumps.json" -Encoding utf8
