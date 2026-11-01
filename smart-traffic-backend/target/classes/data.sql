INSERT IGNORE INTO junctions(id,name) VALUES
('J1','Gandhipuram'),('J2','Ukkadam'),('J3','Singanallur'),('J4','Peelamedu'),
('J5','RS Puram'),('J6','Saibaba Colony'),('J7','Town Hall'),('J8','Race Course'),
('J9','Saravanampatti'),('J10','Ganapathy'),('J11','Hope College'),('J12','Ramanathapuram');
INSERT IGNORE INTO roads(source_id,destination_id,distance_km,base_speed_kmh,traffic_level,closed) VALUES
('J1','J2',4.2,40,'MODERATE',FALSE),('J2','J1',4.2,40,'MODERATE',FALSE),
('J1','J5',2.0,30,'LIGHT',FALSE),('J5','J1',2.0,30,'LIGHT',FALSE),
('J1','J6',2.8,35,'LIGHT',FALSE),('J6','J1',2.8,35,'LIGHT',FALSE),
('J1','J10',3.1,40,'MODERATE',FALSE),('J10','J1',3.1,40,'MODERATE',FALSE),
('J1','J4',5.0,50,'HEAVY',FALSE),('J4','J1',5.0,50,'HEAVY',FALSE),
('J4','J11',1.4,35,'MODERATE',FALSE),('J11','J4',1.4,35,'MODERATE',FALSE),
('J4','J3',6.0,50,'LIGHT',FALSE),('J3','J4',6.0,50,'LIGHT',FALSE),
('J3','J12',3.0,35,'MODERATE',FALSE),('J12','J3',3.0,35,'MODERATE',FALSE),
('J2','J7',1.8,25,'HEAVY',FALSE),('J7','J2',1.8,25,'HEAVY',FALSE),
('J7','J8',2.2,35,'LIGHT',FALSE),('J8','J7',2.2,35,'LIGHT',FALSE),
('J8','J12',4.0,40,'LIGHT',FALSE),('J12','J8',4.0,40,'LIGHT',FALSE),
('J5','J6',1.6,25,'LIGHT',FALSE),('J6','J5',1.6,25,'LIGHT',FALSE),
('J6','J9',7.0,45,'MODERATE',FALSE),('J9','J6',7.0,45,'MODERATE',FALSE),
('J9','J10',3.5,35,'LIGHT',FALSE),('J10','J9',3.5,35,'LIGHT',FALSE),
('J10','J11',4.0,40,'MODERATE',FALSE),('J11','J10',4.0,40,'MODERATE',FALSE),
('J11','J3',4.5,45,'LIGHT',FALSE),('J3','J11',4.5,45,'LIGHT',FALSE),
('J8','J3',3.8,35,'MODERATE',FALSE),('J3','J8',3.8,35,'MODERATE',FALSE);
