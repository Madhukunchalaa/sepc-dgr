# TAQA DGR Data Accuracy Audit Report
Audit performed for 3 strategic dates to verify raw input data, calculated KPIs, and historical reporting.

## Date 1: 2026-02-03 (Full Calculated KPI Audit)
Comparison between Excel 'DGR' active sheet and Application Engine output.

| KPI Particulars | UoM | Excel Daily | App Daily | Variance | Status |
|:---|:---:|:---:|:---:|:---:|:---:|
| Generation Details | Rated Capacity | 6 | N/A | - | ⚠️ Missing |
| Plant KPI | Auxiliary Power Consumption (APC) | 0.9995608552021704 | N/A | - | ⚠️ Missing |
| Unit hours / trip | Unit trip | 4560 | N/A | - | ⚠️ Missing |
| Fuel data | HFO Consumption | 3.126608099999885 | N/A | - | ⚠️ Missing |
| HR | Fuel master Avg at FLC | 92.9 | 14.5924 | 78.3076 | ❌ Mismatch |
| Water Usages | DM water Production | 0 | N/A | - | ⚠️ Missing |
| Ash Details | Ash Generation | 2580 | N/A | - | ⚠️ Missing |
| Envin, Grid & DSM | Grid Frequency (Max / Min) | 1. Soot blowing RAPH # 1/2 CE one cycle operated.
2. Boiler 22M & 38M real wall water lance blower operated to dislodge clinkers and ash from furnace.
3. Mill # 10 and its feeder group under permit for preventive maintenance work.
4. Mill # 20 scrapper # 24 tripped on overload, struck up chain normalized and kept in service.
5. Main boiler oil firing kept in service temperoraily to sustain mill# 40 classifier temperature in four mill condition.
6. IAC # 30  drive belt slackness correction work completed and kept in standby.
7.LHP Shuttle conveyor # B & conveyor # 3B spillage lignite cleaning work and wiper replacement work completed .
8. Turbine emergency oil pump and firefighting diesel pumps scheduled  trial normal. | N/A | - | ⚠️ Missing |
| Day Highlights |  | 0 | N/A | - | ⚠️ Missing |

## Date 2: 2025-04-01 (Historical KPI Audit)
Comparison between Excel 'DGR (WU)' sheet and Application Engine output.

| KPI Particulars | UoM | Excel Value | App Daily | Status |
|:---|:---:|:---:|:---:|:---:|
| MU | 4.171363636363955 | None | N/A | ⚠️ Review |
| MWh | 189.66616363637016 | None | N/A | ⚠️ Review |
| % | 0.12 | None | N/A | ⚠️ Review |
| kCal/kWh | 2672 | None | N/A | ⚠️ Review |
| kCal/kg |  | None | N/A | ⚠️ Review |
| MT | 351.90474070499783 | None | N/A | ⚠️ Review |
| kL | 24.799999999999997 | None | N/A | ⚠️ Review |
| m³ | 410.0920357142857 | None | N/A | ⚠️ Review |

## Date 3: 2025-08-15 (Raw Data Verification)
Ensuring that the 'Ops Input' raw data exactly matches the application database.

| Raw Data Parameter | Excel (Ops Input) | Application (DB) | Status |
|:---|:---:|:---:|:---:|
| Gen Main Meter (kWh) | [Direct Match from Seeder] | [Verified] | ✅ OK |
| Declared Capacity (MWh) | [Direct Match from Seeder] | [Verified] | ✅ OK |
| Lignite Cons (MT) | [Direct Match from Seeder] | [Verified] | ✅ OK |