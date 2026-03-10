-- Run this in pgAdmin to grant dgr_user access to the new table
GRANT ALL PRIVILEGES ON TABLE taqa_daily_input TO dgr_user;
GRANT USAGE ON SEQUENCE taqa_daily_input_id_seq TO dgr_user;
