const { query } = require('../shared/db');
const { success, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

// ─────────────────────────────────────────────
// INCIDENT REPORT
// ─────────────────────────────────────────────
exports.getIncident = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_incident_reports WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return success(res, null); // return null if not found
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get incident error', { message: err.message });
    return error(res, 'Failed to fetch incident report', 500);
  }
};

exports.upsertIncident = async (req, res) => {
  try {
    const { plantId, entryDate, incidentTime, incidentDesc, actionTaken, shiftChargeEngineer } = req.body;
    
    // We do simple conflict on plant_id and entry_date. If multiple are needed, UI should let them append.
    const { rows } = await query(
      `INSERT INTO mis_incident_reports (
         plant_id, entry_date, incident_time, incident_desc, action_taken, shift_charge_engineer, submitted_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (plant_id, entry_date) DO UPDATE SET
         incident_time = EXCLUDED.incident_time,
         incident_desc = EXCLUDED.incident_desc,
         action_taken = EXCLUDED.action_taken,
         shift_charge_engineer = EXCLUDED.shift_charge_engineer,
         updated_at = NOW()
       RETURNING *`,
      [plantId, entryDate, incidentTime, incidentDesc, actionTaken, shiftChargeEngineer, req.user.sub]
    );
    return success(res, rows[0], 'Incident report saved');
  } catch (err) {
    logger.error('Upsert incident error', { message: err.message });
    return error(res, 'Failed to save incident report', 500);
  }
};

// ─────────────────────────────────────────────
// RCA REPORT
// ─────────────────────────────────────────────
exports.getRca = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_rca_reports WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return success(res, null);
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get RCA error', { message: err.message });
    return error(res, 'Failed to fetch RCA report', 500);
  }
};

exports.upsertRca = async (req, res) => {
  try {
    const { plantId, entryDate, data } = req.body;
    const {
      rca_no, report_date, system_name, equipment_name, kks_code,
      breakdown_duration, rca_team, technical_team, fault_defect_event,
      hse_impact, conditions_prior, sequence_of_events, observations,
      why1, why2, why3, direct_cause, underlying_cause, root_cause,
      preventive_actions, corrective_actions, recommendations,
      action_plan_target_date, action_owners, similar_incidents,
      comments_learnings, reviewer_comment, prepared_by, checked_by,
      reviewed_by, approved_by
    } = data;
    
    const { rows } = await query(
      `INSERT INTO mis_rca_reports (
         plant_id, entry_date, rca_no, report_date, system_name, equipment_name, kks_code,
         breakdown_duration, rca_team, technical_team, fault_defect_event, hse_impact,
         conditions_prior, sequence_of_events, observations, why1, why2, why3,
         direct_cause, underlying_cause, root_cause, preventive_actions, corrective_actions,
         recommendations, action_plan_target_date, action_owners, similar_incidents,
         comments_learnings, reviewer_comment, prepared_by, checked_by, reviewed_by, approved_by,
         submitted_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
       )
       ON CONFLICT (plant_id, entry_date) DO UPDATE SET
         rca_no=EXCLUDED.rca_no, report_date=EXCLUDED.report_date, system_name=EXCLUDED.system_name,
         equipment_name=EXCLUDED.equipment_name, kks_code=EXCLUDED.kks_code,
         breakdown_duration=EXCLUDED.breakdown_duration, rca_team=EXCLUDED.rca_team,
         technical_team=EXCLUDED.technical_team, fault_defect_event=EXCLUDED.fault_defect_event,
         hse_impact=EXCLUDED.hse_impact, conditions_prior=EXCLUDED.conditions_prior,
         sequence_of_events=EXCLUDED.sequence_of_events, observations=EXCLUDED.observations,
         why1=EXCLUDED.why1, why2=EXCLUDED.why2, why3=EXCLUDED.why3,
         direct_cause=EXCLUDED.direct_cause, underlying_cause=EXCLUDED.underlying_cause,
         root_cause=EXCLUDED.root_cause, preventive_actions=EXCLUDED.preventive_actions,
         corrective_actions=EXCLUDED.corrective_actions, recommendations=EXCLUDED.recommendations,
         action_plan_target_date=EXCLUDED.action_plan_target_date, action_owners=EXCLUDED.action_owners,
         similar_incidents=EXCLUDED.similar_incidents, comments_learnings=EXCLUDED.comments_learnings,
         reviewer_comment=EXCLUDED.reviewer_comment, prepared_by=EXCLUDED.prepared_by,
         checked_by=EXCLUDED.checked_by, reviewed_by=EXCLUDED.reviewed_by, approved_by=EXCLUDED.approved_by,
         updated_at = NOW()
       RETURNING *`,
      [
         plantId, entryDate, rca_no, report_date, system_name, equipment_name, kks_code,
         breakdown_duration, rca_team, technical_team, fault_defect_event, hse_impact,
         conditions_prior, sequence_of_events, observations, why1, why2, why3,
         direct_cause, underlying_cause, root_cause, preventive_actions, corrective_actions,
         recommendations, action_plan_target_date, action_owners, similar_incidents,
         comments_learnings, reviewer_comment, prepared_by, checked_by, reviewed_by, approved_by,
         req.user.sub
      ]
    );
    return success(res, rows[0], 'RCA report saved');
  } catch (err) {
    logger.error('Upsert RCA error', { message: err.message });
    return error(res, 'Failed to save RCA report', 500);
  }
};

// ─────────────────────────────────────────────
// UNIT TRIP REPORT
// ─────────────────────────────────────────────
exports.getTrip = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_trip_reports WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return success(res, null);
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get trip error', { message: err.message });
    return error(res, 'Failed to fetch Trip report', 500);
  }
};

exports.upsertTrip = async (req, res) => {
  try {
    const { plantId, entryDate, data } = req.body;
    const {
      trip_report_no, report_date, trip_time, trip_duration,
      pre_existing_load, system_abnormal_conditions, equipment_tripped,
      root_cause, immediate_actions, consequential_damage,
      actions_taken_to_restart, committee_observation, recommendation
    } = data;
    
    const { rows } = await query(
      `INSERT INTO mis_trip_reports (
         plant_id, entry_date, trip_report_no, report_date, trip_time, trip_duration,
         pre_existing_load, system_abnormal_conditions, equipment_tripped,
         root_cause, immediate_actions, consequential_damage,
         actions_taken_to_restart, committee_observation, recommendation,
         submitted_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
       )
       ON CONFLICT (plant_id, entry_date) DO UPDATE SET
         trip_report_no=EXCLUDED.trip_report_no, report_date=EXCLUDED.report_date,
         trip_time=EXCLUDED.trip_time, trip_duration=EXCLUDED.trip_duration,
         pre_existing_load=EXCLUDED.pre_existing_load,
         system_abnormal_conditions=EXCLUDED.system_abnormal_conditions,
         equipment_tripped=EXCLUDED.equipment_tripped, root_cause=EXCLUDED.root_cause,
         immediate_actions=EXCLUDED.immediate_actions, consequential_damage=EXCLUDED.consequential_damage,
         actions_taken_to_restart=EXCLUDED.actions_taken_to_restart,
         committee_observation=EXCLUDED.committee_observation, recommendation=EXCLUDED.recommendation,
         updated_at = NOW()
       RETURNING *`,
      [
        plantId, entryDate, trip_report_no, report_date, trip_time, trip_duration,
        pre_existing_load, system_abnormal_conditions, equipment_tripped,
        root_cause, immediate_actions, consequential_damage,
        actions_taken_to_restart, committee_observation, recommendation,
        req.user.sub
      ]
    );
    return success(res, rows[0], 'Trip report saved');
  } catch (err) {
    logger.error('Upsert trip error', { message: err.message });
    return error(res, 'Failed to save Trip report', 500);
  }
};

// ─────────────────────────────────────────────
// BTG REPORT
// ─────────────────────────────────────────────
exports.getBtg = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_btg_reports WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return success(res, null);
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get BTG error', { message: err.message });
    return error(res, 'Failed to fetch BTG report', 500);
  }
};

exports.upsertBtg = async (req, res) => {
  try {
    const { plantId, entryDate, data } = req.body;
    const { rows } = await query(
      `INSERT INTO mis_btg_reports (plant_id, entry_date, data, submitted_by) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plant_id, entry_date) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = NOW()
       RETURNING *`,
      [plantId, entryDate, data, req.user.sub]
    );
    return success(res, rows[0], 'BTG report saved');
  } catch (err) {
    logger.error('Upsert BTG error', { message: err.message });
    return error(res, 'Failed to save BTG report', 500);
  }
};

// ─────────────────────────────────────────────
// LOAD RECORD STATEMENT
// ─────────────────────────────────────────────
exports.getLoadRecord = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_load_records WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, date]
    );
    if (!rows[0]) return success(res, null);
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get Load Record error', { message: err.message });
    return error(res, 'Failed to fetch Load Record', 500);
  }
};

exports.upsertLoadRecord = async (req, res) => {
  try {
    const { plantId, entryDate, data } = req.body;
    const { rows } = await query(
      `INSERT INTO mis_load_records (plant_id, entry_date, data, submitted_by) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plant_id, entry_date) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = NOW()
       RETURNING *`,
      [plantId, entryDate, data, req.user.sub]
    );
    return success(res, rows[0], 'Load Record saved');
  } catch (err) {
    logger.error('Upsert Load Record error', { message: err.message });
    return error(res, 'Failed to save Load Record', 500);
  }
};

// ─────────────────────────────────────────────
// MOC REPORT
// ─────────────────────────────────────────────
exports.getMoc = async (req, res) => {
  try {
    const { plantId, mocNo } = req.params;
    const { rows } = await query(
      `SELECT * FROM mis_moc_records WHERE plant_id = $1 AND moc_no = $2`,
      [plantId, mocNo]
    );
    if (!rows[0]) return success(res, null);
    return success(res, rows[0]);
  } catch (err) {
    logger.error('Get MOC error', { message: err.message });
    return error(res, 'Failed to fetch MOC report', 500);
  }
};

exports.upsertMoc = async (req, res) => {
  try {
    const { plantId, mocNo, initiationDate, data } = req.body;
    const { rows } = await query(
      `INSERT INTO mis_moc_records (plant_id, moc_no, initiation_date, data, submitted_by) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (plant_id, moc_no) DO UPDATE SET
         initiation_date = EXCLUDED.initiation_date,
         data = EXCLUDED.data,
         updated_at = NOW()
       RETURNING *`,
      [plantId, mocNo, initiationDate, data, req.user.sub]
    );
    return success(res, rows[0], 'MOC report saved');
  } catch (err) {
    logger.error('Upsert MOC error', { message: err.message });
    return error(res, 'Failed to save MOC report', 500);
  }
};
