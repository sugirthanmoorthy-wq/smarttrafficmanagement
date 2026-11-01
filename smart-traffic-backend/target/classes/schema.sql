CREATE TABLE IF NOT EXISTS junctions (
  id VARCHAR(12) PRIMARY KEY, name VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS roads (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id VARCHAR(12) NOT NULL, destination_id VARCHAR(12) NOT NULL,
  distance_km DOUBLE NOT NULL, base_speed_kmh DOUBLE NOT NULL DEFAULT 40,
  traffic_level VARCHAR(20) NOT NULL DEFAULT 'LIGHT',
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_road_source FOREIGN KEY (source_id) REFERENCES junctions(id),
  CONSTRAINT fk_road_destination FOREIGN KEY (destination_id) REFERENCES junctions(id),
  UNIQUE KEY uq_road_pair (source_id, destination_id)
);
CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(40) PRIMARY KEY, vehicle_type VARCHAR(24) NOT NULL,
  source_id VARCHAR(12) NOT NULL, destination_id VARCHAR(12) NOT NULL,
  route_json TEXT, distance_km DOUBLE, estimated_ticks DOUBLE,
  status VARCHAR(24) NOT NULL DEFAULT 'DISPATCHED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS traffic_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT, event_type VARCHAR(40) NOT NULL,
  description VARCHAR(500) NOT NULL, junction_id VARCHAR(12),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS signal_states (
  junction_id VARCHAR(12) PRIMARY KEY,
  phase VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  priority_vehicle_id VARCHAR(40),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_signal_junction FOREIGN KEY (junction_id) REFERENCES junctions(id)
);
