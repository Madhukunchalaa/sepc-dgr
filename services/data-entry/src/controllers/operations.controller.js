// services/data-entry/src/controllers/operations.controller.js
const { query } = require('../shared/db');

exports.getEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        if (!plantId || !date) return res.status(400).json({ error: 'Missing plantId or date' });

        const { rows } = await query(
            `SELECT * FROM operations_log WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );
        res.json({ data: rows[0] || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving operations data' });
    }
};

exports.upsertEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        if (!plantId || !date || !data) return res.status(400).json({ error: 'Invalid payload' });

        const q = `
      INSERT INTO operations_log (
        plant_id, entry_date, 
        boiler_activities, turbine_activities, electrical_activities, bop_activities,
        running_equipment, outage_details, remarks, observations,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        boiler_activities = EXCLUDED.boiler_activities,
        turbine_activities = EXCLUDED.turbine_activities,
        electrical_activities = EXCLUDED.electrical_activities,
        bop_activities = EXCLUDED.bop_activities,
        running_equipment = EXCLUDED.running_equipment,
        outage_details = EXCLUDED.outage_details,
        remarks = EXCLUDED.remarks,
        observations = EXCLUDED.observations,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [
            plantId, date,
            data.boilerActivities, data.turbineActivities, data.electricalActivities, data.bopActivities,
            data.runningEquipment, data.outageDetails,
            data.remarks, data.observations
        ];

        const { rows } = await query(q, values);
        res.json({ message: 'Operations data saved', data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save operations data' });
    }
};

exports.submitEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE operations_log SET status = 'submitted', submitted_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Operations data submitted', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit' });
    }
};

exports.approveEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE operations_log SET status = 'approved', approved_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Operations data approved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve' });
    }
};
