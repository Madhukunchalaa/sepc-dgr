-- 1. Create daily_ash table
CREATE TABLE IF NOT EXISTS daily_ash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id),
  entry_date DATE NOT NULL,
  
  fa_generated_mt NUMERIC(15,3) DEFAULT 0,
  fa_to_user_mt NUMERIC(15,3) DEFAULT 0,
  fa_to_dyke_mt NUMERIC(15,3) DEFAULT 0,
  fa_silo_mt NUMERIC(15,3) DEFAULT 0,
  
  ba_generated_mt NUMERIC(15,3) DEFAULT 0,
  ba_to_user_mt NUMERIC(15,3) DEFAULT 0,
  ba_to_dyke_mt NUMERIC(15,3) DEFAULT 0,
  ba_silo_mt NUMERIC(15,3) DEFAULT 0,
  
  submitted_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plant_id, entry_date)
);

-- 2. Create daily_dsm table
CREATE TABLE IF NOT EXISTS daily_dsm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id),
  entry_date DATE NOT NULL,
  
  dsm_net_profit_lacs NUMERIC(15,3) DEFAULT 0,
  dsm_payable_lacs NUMERIC(15,3) DEFAULT 0,
  dsm_receivable_lacs NUMERIC(15,3) DEFAULT 0,
  dsm_coal_saving_lacs NUMERIC(15,3) DEFAULT 0,
  
  submitted_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plant_id, entry_date)
);

-- 3. Modify daily_water
ALTER TABLE daily_water 
ADD COLUMN IF NOT EXISTS swi_flow_m3 NUMERIC(15,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS outfall_m3 NUMERIC(15,3) DEFAULT 0;

-- 4. Modify daily_scheduling
ALTER TABLE daily_scheduling 
ADD COLUMN IF NOT EXISTS urs_net_profit_lacs NUMERIC(15,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dc_loss_reasons JSONB DEFAULT '[]'::jsonb;
