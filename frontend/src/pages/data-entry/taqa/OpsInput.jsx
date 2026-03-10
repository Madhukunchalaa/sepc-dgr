// src/pages/data-entry/taqa/OpsInput.jsx
// Complete 154-field Ops Input form mirroring the TAQA Excel "Ops Input" sheet
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../../context/PlantContext'
import { dataEntry } from '../../../api'

const F = ({ label, name, unit, type = 'number', form, onChange, wide, prevForm }) => {
    const value = form?.[name] ?? ''
    const prevValue = prevForm?.[name]
    return (
        <div className="form-group" style={wide ? { gridColumn: '1 / -1' } : {}}>
            <label className="form-label" title={label}>{label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({unit})</span></label>
            {type === 'textarea'
                ? <textarea className="form-input" rows={2} name={name} value={value} onChange={onChange} />
                : <input className="form-input" type={type} step="any" name={name} value={value} onChange={onChange} />
            }
            {prevValue !== undefined && prevValue !== '' && prevValue !== null && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                    Prev: <span style={{ fontWeight: 600 }}>{prevValue}</span>
                </div>
            )}
        </div>
    )
}

const Section = ({ title, children }) => (
    <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-hdr" style={{ fontWeight: 700 }}>{title}</div>
        <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px 20px' }}>
                {children}
            </div>
        </div>
    </div>
)

export default function OpsInput() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [prevForm, setPrevForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()

    const plantId = selectedPlant?.id
    const isTaqa = useMemo(() => selectedPlant?.short_name?.startsWith('TAQA'), [selectedPlant])

    const prevDate = useMemo(() => {
        const d = new Date(date)
        d.setDate(d.getDate() - 1)
        return d.toISOString().split('T')[0]
    }, [date])

    const cleanRowToForm = (obj) => {
        if (!obj || typeof obj !== 'object') return {}
        const {
            // eslint-disable-next-line no-unused-vars
            id, plant_id, entry_date, created_at, updated_at,
            // eslint-disable-next-line no-unused-vars
            submitted_by, submitted_at, approved_by, approved_at, status,
            ...fields
        } = obj
        return Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [k, v == null || v === '' ? '' : String(v)])
        )
    }

    const { data: currentRes, isFetching: isFetchingCurrent } = useQuery({
        queryKey: ['taqa-ops-input', plantId, date],
        queryFn: () => dataEntry.getTaqaEntry(plantId, date),
        enabled: !!plantId && !!date && isTaqa,
        retry: false,
    })

    const { data: prevRes, isFetching: isFetchingPrev } = useQuery({
        queryKey: ['taqa-ops-input-prev', plantId, prevDate],
        queryFn: () => dataEntry.getTaqaEntry(plantId, prevDate),
        enabled: !!plantId && !!prevDate && isTaqa,
        retry: false,
    })

    // Sync state (mirrors stable SEPC entry pages)
    // Clear form when date or plant changes to avoid showing stale data
    useEffect(() => {
        if (isTaqa) {
            setForm({})
            setPrevForm({})
            setMsg(null)
        }
    }, [date, plantId, isTaqa])

    useEffect(() => {
        if (!isTaqa) return
        const row = currentRes?.data?.data ?? {}
        if (row && Object.keys(row).length > 0) {
            setForm(cleanRowToForm(row))
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        } else if (!isFetchingCurrent) {
            // Only clear if we are NOT fetching (e.g. 404 / no data)
            setForm({})
        }
    }, [currentRes, isFetchingCurrent, isTaqa])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))



    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveTaqaEntry(plantId, date, form),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ Ops Input saved as draft.' })
            await qc.invalidateQueries({ queryKey: ['taqa-ops-input', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    const submitMutation = useMutation({
        mutationFn: () => dataEntry.submitTaqaEntry(plantId, date),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✅ Submitted! DGR metrics calculated.' })
            qc.invalidateQueries({ queryKey: ['taqa-ops-input', plantId, date] })
            qc.invalidateQueries({ queryKey: ['dgr-full', plantId, date] })
            qc.invalidateQueries({ queryKey: ['submission-status', plantId] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Submit failed' }),
    })

    const p = { form, onChange, prevForm }

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-title">⚙️ Ops Input — {selectedPlant?.short_name || 'TAQA'}</div>
            <div className="page-sub">Daily Station Data — 154 fields (mirrors Excel Ops Input sheet)</div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Entry Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={date}
                            onChange={e => {
                                setDate(e.target.value)
                                setMsg(null)
                            }}
                            max={today}
                        />
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        Plant: <strong>{selectedPlant?.name || 'None'}</strong>
                    </div>
                    {(isFetchingCurrent || isFetchingPrev) && <div style={{ fontSize: 13, color: 'var(--primary)' }}>⏳ Loading data for {date}...</div>}
                    {!(isFetchingCurrent || isFetchingPrev) && isTaqa && Object.keys(form).some(k => form[k] !== '' && form[k] !== null) &&
                        <div style={{ fontSize: 12, background: 'var(--success-bg, #e6f4ea)', color: 'var(--success, #2e7d32)', padding: '4px 10px', borderRadius: 6 }}>
                            ✅ Data loaded from database
                        </div>
                    }
                    {!(isFetchingCurrent || isFetchingPrev) && !isTaqa && (
                        <div style={{ fontSize: 12, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 6 }}>
                            ⚠️ Please select TAQA plant from sidebar to enter data.
                        </div>
                    )}
                </div>
            </div>

            {!isTaqa && (
                <div className="alert alert-error">
                    <strong>Invalid Plant Selected:</strong> This form is specifically for high-detail TAQA station input.
                    Please switch to <b>TAQA</b> in the sidebar to proceed.
                </div>
            )}

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            {/* ── HFO TANKS ─────────────────────────────────────────────────── */}
            <Section title="🛢️ HFO Tanks">
                <F label="T-10 Level (Calc)" name="hfo_t10_lvl_calc" unit="cm" {...p} />
                <F label="T-10 Level (Panel)" name="hfo_t10_lvl_panel" unit="cm" {...p} />
                <F label="T-10 Level (Radar)" name="hfo_t10_lvl_radar" unit="cm" {...p} />
                <F label="T-10 Tank Temp" name="hfo_t10_temp" unit="°C" {...p} />
                <F label="T-20 Level (Calc)" name="hfo_t20_lvl_calc" unit="cm" {...p} />
                <F label="T-20 Level (Panel)" name="hfo_t20_lvl_panel" unit="cm" {...p} />
                <F label="T-20 Level (Radar)" name="hfo_t20_lvl_radar" unit="cm" {...p} />
                <F label="T-20 Tank Temp" name="hfo_t20_temp" unit="°C" {...p} />
                <F label="HFO Receipt Qty" name="hfo_receipt_mt" unit="MT" {...p} />
                <F label="Main Boiler Supply FO Int. Rdg" name="hfo_supply_int_rdg" unit="Litres" {...p} />
                <F label="Main Boiler Return FO Int. Rdg" name="hfo_return_int_rdg" unit="Litres" {...p} />
            </Section>

            {/* ── HSD TANKS ─────────────────────────────────────────────────── */}
            <Section title="⛽ HSD Tanks">
                <F label="T-30 Level (Max 580cm = 114.7KL)" name="hsd_t30_lvl" unit="cm" {...p} />
                <F label="T-30 Receipt" name="hsd_t30_receipt_kl" unit="KL" {...p} />
                <F label="T-40 Level (Max 160cm = 11.44KL)" name="hsd_t40_lvl" unit="cm" {...p} />
                <F label="T-40 Receipt" name="hsd_t40_receipt_kl" unit="KL" {...p} />
            </Section>

            {/* ── LIGNITE ───────────────────────────────────────────────────── */}
            <Section title="🪨 Lignite">
                <F label="BC #1 Lignite Receipt Integrator" name="lignite_bc1_int_rdg" unit="MT" {...p} />
                <F label="Lignite Receipt at TAQA-WB (06:00 to 06:00)" name="lignite_receipt_taqa_wb" unit="MT" {...p} />
                <F label="Lignite lifted from Mines-NLCIL-WB" name="lignite_lifted_nlcil_wb" unit="MT" {...p} />
                <F label="Vadallur Silo Closing Stock" name="lignite_vadallur_silo" unit="MT" {...p} />
                <F label="Conveyor 1A Load Cell Integrator" name="lignite_conv_1a_int_rdg" unit="MT" {...p} />
                <F label="Conveyor 1B Load Cell Integrator" name="lignite_conv_1b_int_rdg" unit="MT" {...p} />
                <F label="Lignite Direct Feeding to Boiler Bunkers" name="lignite_direct_feed" unit="MT" {...p} />
                <F label="Cumulative Lignite Bunker Level at 24:00" name="lignite_bunker_lvl" unit="%" {...p} />
                <F label="Fuel Master at 250MW (24hr Avg)" name="fuel_master_250mw" unit="%" {...p} />
                <F label="Fuel Master at 170MW (24hr Avg)" name="fuel_master_170mw" unit="%" {...p} />
            </Section>

            {/* ── METER READINGS ─────────────────────────────────────────────── */}
            <Section title="⚡ Meter Readings (MWhr)">
                <F label="Perambalur Import (main)" name="peram_imp_main" unit="MWhr" {...p} />
                <F label="Perambalur Export (main)" name="peram_exp_main" unit="MWhr" {...p} />
                <F label="Perambalur Import (check)" name="peram_imp_check" unit="MWhr" {...p} />
                <F label="Perambalur Export (check)" name="peram_exp_check" unit="MWhr" {...p} />
                <F label="Deviakurichi Import (main)" name="deviak_imp_main" unit="MWhr" {...p} />
                <F label="Deviakurichi Export (main)" name="deviak_exp_main" unit="MWhr" {...p} />
                <F label="Deviakurichi Import (check)" name="deviak_imp_check" unit="MWhr" {...p} />
                <F label="Deviakurichi Export (check)" name="deviak_exp_check" unit="MWhr" {...p} />
                <F label="Cuddalore Import (main)" name="cuddal_imp_main" unit="MWhr" {...p} />
                <F label="Cuddalore Export (main)" name="cuddal_exp_main" unit="MWhr" {...p} />
                <F label="Cuddalore Import (check)" name="cuddal_imp_check" unit="MWhr" {...p} />
                <F label="Cuddalore Export (check)" name="cuddal_exp_check" unit="MWhr" {...p} />
                <F label="NLC-II Import (main)" name="nlc2_imp_main" unit="MWhr" {...p} />
                <F label="NLC-II Export (main)" name="nlc2_exp_main" unit="MWhr" {...p} />
                <F label="NLC-II Import (check)" name="nlc2_imp_check" unit="MWhr" {...p} />
                <F label="NLC-II Export (check)" name="nlc2_exp_check" unit="MWhr" {...p} />
                <F label="Net Import (Switchyard meters)" name="net_import_sy" unit="MWhr" {...p} />
                <F label="Import UAT 1 & 2 meters" name="import_uat" unit="MWhr" {...p} />
                <F label="Net Export" name="net_export" unit="MWhr" {...p} />
                <F label="Schedule Generation from MLDC (SG)" name="schedule_gen_mldc" unit="MWhr" {...p} />
                <F label="Generator Main Meter (Display 3)" name="gen_main_meter" unit="MWhr" {...p} />
                <F label="Generator Check Meter (Display 3)" name="gen_check_meter" unit="MWhr" {...p} />
                <F label="UAT #1 Main Reading" name="uat1_main_rdg" unit="MWhr" {...p} />
                <F label="UAT #1 Check Reading" name="uat1_check_rdg" unit="MWhr" {...p} />
                <F label="UAT #2 Main Reading" name="uat2_main_rdg" unit="MWhr" {...p} />
                <F label="UAT #2 Check Reading" name="uat2_check_rdg" unit="MWhr" {...p} />
                <F label="GT Bay Import (Display 1+3)" name="gt_bay_imp_rdg" unit="MWh" {...p} />
                <F label="GT Bay Export (Display 1+3)" name="gt_bay_exp_rdg" unit="MWh" {...p} />
            </Section>

            {/* ── GENERATION / SCHEDULING ───────────────────────────────────── */}
            <Section title="🏭 Generation & Scheduling">
                <F label="Declared Capacity" name="declared_capacity_mwhr" unit="MWhr" {...p} />
                <F label="Deemed Generation" name="deemed_gen_mwhr" unit="MWhr" {...p} />
                <F label="Dispatch Demand" name="dispatch_demand_mwhr" unit="MWhr" {...p} />
            </Section>

            {/* ── OUTAGES / HOURS ───────────────────────────────────────────── */}
            <Section title="⏱️ Durations & Outages">
                <F label="No. of Unit Trips" name="no_unit_trips" unit="No's" {...p} />
                <F label="No. of Unit Shutdown" name="no_unit_shutdown" unit="No's" {...p} />
                <F label="Dispatch Duration" name="dispatch_duration" unit="hrs" {...p} />
                <F label="Load Backdown Duration" name="load_backdown_duration" unit="hrs" {...p} />
                <F label="Unit on Standby" name="unit_standby_hrs" unit="hrs" {...p} />
                <F label="Scheduled Outage Duration" name="scheduled_outage_hrs" unit="hrs" {...p} />
                <F label="Forced Outage Duration" name="forced_outage_hrs" unit="hrs" {...p} />
                <F label="De-rated Equivalent Outage Duration" name="derated_outage_hrs" unit="hrs" {...p} />
                <F label="Total Hours" name="total_hours" unit="hrs" {...p} />
                <F label="No. of Load Pickup Instructions" name="no_load_pickup_inst" unit="No's" {...p} />
                <F label="No. of Load Back-down Instructions" name="no_load_backdown_inst" unit="No's" {...p} />
            </Section>

            {/* ── DSM ──────────────────────────────────────────────────────── */}
            <Section title="💰 DSM Charges">
                <F label="DSM Charges (payable/receivables)" name="dsm_charges" unit="Rs" {...p} />
                <F label="Net Gain / Loss" name="net_gain_loss" unit="Rs" {...p} />
                <F label="Fuel Saved / Loss" name="fuel_saved_loss" unit="Rs" {...p} />
                <F label="Remarks" name="remarks" unit="text" type="textarea" wide {...p} />
            </Section>

            {/* ── WATER TANK LEVELS ────────────────────────────────────────── */}
            <Section title="💧 Water Tank Levels">
                <F label="Reservoir #1 Level" name="reservoir1_lvl" unit="M" {...p} />
                <F label="Reservoir #2 Level" name="reservoir2_lvl" unit="M" {...p} />
                <F label="DM Water Storage Tank Level" name="dm_storage_tank_lvl" unit="M" {...p} />
                <F label="Potable Water Tank Level" name="potable_tank_lvl" unit="M" {...p} />
                <F label="Reserve Condensate Tank Level" name="reserve_condensate_lvl" unit="M" {...p} />
                <F label="Boiler Condensate Tank Level" name="boiler_condensate_lvl" unit="CM" {...p} />
                <F label="Condensate Drain Tank Level" name="condensate_drain_lvl" unit="mm" {...p} />
            </Section>

            {/* ── WATER INTEGRATORS ────────────────────────────────────────── */}
            <Section title="💧 Water Integrator Readings (M³)">
                <F label="DM Plant Water Production" name="dm_water_prod_m3" unit="M³" {...p} />
                <F label="Borewell Header to Reservoir" name="borewell_to_reservoir" unit="M³" {...p} />
                <F label="Borewell to CW Forebay Makeup" name="borewell_to_cw_forebay" unit="M³" {...p} />
                <F label="Reservoir to CW Forebay Makeup" name="reservoir_to_cw_forebay" unit="M³" {...p} />
                <F label="CMB Discharge to CW Forebay" name="cmb_to_cw_forebay" unit="M³" {...p} />
                <F label="CW Blowdown" name="cw_blowdown" unit="M³" {...p} />
                <F label="CW Blowdown to AHP" name="cw_blowdown_to_ahp" unit="M³" {...p} />
                <F label="CW Blowdown to Village Pond" name="cw_blowdown_to_village" unit="M³" {...p} />
                <F label="Service Water Discharge Flow" name="service_water_flow" unit="M³" {...p} />
                <F label="Seal Water Supply" name="seal_water_supply" unit="M³" {...p} />
                <F label="Seal Water Return to Service Sump" name="seal_water_return" unit="M³" {...p} />
                <F label="Raw Water from Reservoir to DM Plant" name="raw_water_to_dm" unit="M³" {...p} />
                <F label="Potable Tank Makeup" name="potable_tank_makeup" unit="M³" {...p} />
                <F label="DM Water to Condenser/CST" name="dm_to_condenser" unit="M³" {...p} />
                <F label="CST to Main Unit (RCTP discharge)" name="cst_to_main_unit" unit="M³" {...p} />
                <F label="STP Inlet Flow" name="stp_inlet_flow" unit="M³" {...p} />
                <F label="STP Treated Water Flow" name="stp_treated_flow" unit="M³" {...p} />
                <F label="Fire Fighting Water Flow" name="firefighting_flow" unit="M³" {...p} />
                <F label="Drinking Water to Village #1" name="village_water1" unit="M³" {...p} />
                <F label="Drinking Water to Village #2" name="village_water2" unit="M³" {...p} />
                <F label="Ash Pond Overflow" name="ash_pond_overflow" unit="M³" {...p} />
            </Section>

            {/* ── LHP / MILL OPERATING HOURS ───────────────────────────────── */}
            <Section title="🔧 LHP / Mill Operating Hours">
                <F label="LHP Conveyor 1A" name="lhp_conv_1a_hrs" unit="hrs" {...p} />
                <F label="LHP Conveyor 1B" name="lhp_conv_1b_hrs" unit="hrs" {...p} />
                <F label="LHP Auto Sampler" name="lhp_autosampler_hrs" unit="hrs" {...p} />
                <F label="LHP DSS Pump-1" name="lhp_dss_pump1_hrs" unit="hrs" {...p} />
                <F label="LHP DSS Pump-2" name="lhp_dss_pump2_hrs" unit="hrs" {...p} />
                <F label="Firefighting Electric Hydrant-201" name="ff_hydrant_201_hrs" unit="hrs" {...p} />
                <F label="Firefighting Electric Spray-301" name="ff_spray_301_hrs" unit="hrs" {...p} />
                <F label="Mill 10 (Lignite Conveyor 14)" name="mill10_hrs" unit="hrs" {...p} />
                <F label="Mill 20 (Lignite Conveyor 24)" name="mill20_hrs" unit="hrs" {...p} />
                <F label="Mill 30 (Lignite Conveyor 35)" name="mill30_hrs" unit="hrs" {...p} />
                <F label="Mill 40 (Lignite Conveyor 45)" name="mill40_hrs" unit="hrs" {...p} />
                <F label="Mill 50 (Lignite Conveyor 54)" name="mill50_hrs" unit="hrs" {...p} />
                <F label="Mill 60 (Lignite Conveyor 64)" name="mill60_hrs" unit="hrs" {...p} />
            </Section>

            {/* ── EQUIPMENT kWh ────────────────────────────────────────────── */}
            <Section title="📟 Equipment Cumulative kWh Readings">
                <F label="Boiler Feed Pump-1" name="bfp1_kwh" unit="Cu kWh" {...p} />
                <F label="Boiler Feed Pump-2" name="bfp2_kwh" unit="Cu kWh" {...p} />
                <F label="Boiler Feed Pump-3" name="bfp3_kwh" unit="Cu kWh" {...p} />
                <F label="Main CW Pump-1" name="mcwp1_kwh" unit="Cu kWh" {...p} />
                <F label="Main CW Pump-2" name="mcwp2_kwh" unit="Cu kWh" {...p} />
                <F label="Main CW Pump-3" name="mcwp3_kwh" unit="Cu kWh" {...p} />
                <F label="Condensate Extraction Pump-1" name="cep1_kwh" unit="Cu kWh" {...p} />
                <F label="Condensate Extraction Pump-2" name="cep2_kwh" unit="Cu kWh" {...p} />
                <F label="Forced Draft Fan-1" name="fdf1_kwh" unit="Cu kWh" {...p} />
                <F label="Forced Draft Fan-2" name="fdf2_kwh" unit="Cu kWh" {...p} />
                <F label="Instrument Air Compressor-1" name="iac1_kwh" unit="Cu kWh" {...p} />
                <F label="Instrument Air Compressor-2" name="iac2_kwh" unit="Cu kWh" {...p} />
                <F label="Instrument Air Compressor-3" name="iac3_kwh" unit="Cu kWh" {...p} />
                <F label="Conveying Air Compressor-1" name="cac1_kwh" unit="Cu kWh" {...p} />
                <F label="Conveying Air Compressor-2" name="cac2_kwh" unit="Cu kWh" {...p} />
                <F label="Conveying Air Compressor-3" name="cac3_kwh" unit="Cu kWh" {...p} />
                <F label="LHP Incomer-1" name="lhp_inc1_kwh" unit="Cu kWh" {...p} />
                <F label="LHP Incomer-2" name="lhp_inc2_kwh" unit="Cu kWh" {...p} />
                <F label="FF Electric Spray-201" name="ff_spray_201_kwh" unit="Cu kWh" {...p} />
                <F label="FF Electric Hydrant-301" name="ff_hydrant_301_kwh" unit="Cu kWh" {...p} />
                <F label="STP Incomer" name="stp_kwh" unit="Cu kWh" {...p} />
            </Section>

            {/* ── ASH ──────────────────────────────────────────────────────── */}
            <Section title="💨 Ash Handling">
                <F label="Bottom Ash Trucks (Internal)" name="ba_trucks_internal" unit="No's" {...p} />
                <F label="Bottom Ash Trucks (External Party)" name="ba_trucks_external" unit="No's" {...p} />
                <F label="Fly Ash Silo Level" name="fa_silo_lvl_pct" unit="%" {...p} />
                <F label="Fly Ash Trucks" name="fa_trucks" unit="No's" {...p} />
                <F label="Fly Ash to Ash Pond (Wet disposal)" name="fa_to_ash_pond_mt" unit="Mton" {...p} />
                <F label="AHP Rotary Feeder #1" name="ahp_rot_feed1_hrs" unit="hrs" {...p} />
                <F label="AHP Rotary Feeder #2" name="ahp_rot_feed2_hrs" unit="hrs" {...p} />
                <F label="Ash Transmitter Outage (all Tx incl RAPH)" name="ash_tx_outage_hrs" unit="hrs" {...p} />
            </Section>

            {/* ── MISC ─────────────────────────────────────────────────────── */}
            <Section title="📝 Miscellaneous">
                <F label="Hydrogen Cylinders (00:00-24:00)" name="h2_cylinders" unit="No's" {...p} />
                <F label="Oxygen Cylinders (00:00-24:00)" name="o2_cylinders" unit="No's" {...p} />
                <F label="CTCS Balls Collected from System" name="ctcs_balls_collected" unit="No's" {...p} />
                <F label="CTCS Balls Added" name="ctcs_balls_added" unit="No's" {...p} />
                <F label="Small IAC Running Hours" name="small_iac_hrs" unit="hrs" {...p} />
                <F label="Grid Frequency Max" name="grid_freq_max" unit="Hz" {...p} />
                <F label="Grid Frequency Min" name="grid_freq_min" unit="Hz" {...p} />
                <F label="Ambient Temp Max" name="ambient_temp_max" unit="°C" {...p} />
                <F label="Ambient Temp Min" name="ambient_temp_min" unit="°C" {...p} />
                <F label="Relative Humidity Max" name="humidity_max" unit="%" {...p} />
                <F label="Relative Humidity Min" name="humidity_min" unit="%" {...p} />
                <F label="Day Highlights" name="day_highlights" unit="text" type="textarea" wide {...p} />
                <F label="Grid Disturbance" name="grid_disturbance" unit="text" type="textarea" wide {...p} />
            </Section>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '16px 0', borderTop: '1px solid var(--border)', zIndex: 10 }}>
                <button
                    className="btn btn-ghost"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !isTaqa}
                >
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Draft'}
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || !isTaqa}
                >
                    {submitMutation.isPending ? '⏳ Calculating...' : '✅ Submit & Calculate DGR'}
                </button>
            </div>
        </div>
    )
}
