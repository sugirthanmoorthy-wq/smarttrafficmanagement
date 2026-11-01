# Smart Traffic Management Backend (Spring Boot + MySQL)

This backend is designed for the uploaded Coimbatore Smart Traffic Management HTML dashboard. It provides REST endpoints for junctions, roads, Dijkstra routing, automatic traffic generation, emergency dispatch/green-corridor signal priority, signals, vehicles, and events. It does not replace or modify your existing frontend algorithms.

## Requirements
- JDK 17+
- Maven 3.9+
- MySQL 8+

## Run
1. Start MySQL.
2. Open MySQL Workbench or phpMyAdmin and run `CREATE DATABASE smart_traffic;` (optional; the JDBC URL also requests database creation).
3. If your MySQL credentials are not `root` with an empty password, set environment variables:
   - Windows PowerShell: `$env:DB_USER="root"; $env:DB_PASSWORD="your_password"`
   - macOS/Linux: `export DB_USER=root; export DB_PASSWORD='your_password'`
4. From this folder run: `mvn spring-boot:run`
5. Test `http://localhost:8080/api/health`.

Spring Boot runs `schema.sql` and `data.sql` on startup. Sample network junction IDs are J1-J12. The sample network is simulation data, not a live map of real traffic.

## API
- `GET /api/health`
- `GET /api/network/junctions`
- `GET /api/network/roads`
- `POST /api/routes/find` body: `{"vehicleType":"NORMAL","source":"J1","destination":"J3"}`
- `POST /api/traffic/generate` body: `{"count":6}` (3-10)
- `POST /api/emergency/request` body: `{"id":"AMB-001","vehicleType":"AMBULANCE","source":"J1","destination":"J3"}`
- `GET /api/signals`
- `POST /api/roads/update` body: `{"source":"J1","destination":"J2","closed":true,"trafficLevel":"HEAVY"}`
- `GET /api/vehicles`
- `GET /api/events`

## Frontend connection
Your HTML already has `js/api.js`, `js/network.js`, `js/dashboard.js`, etc. script references, but those JavaScript files were not among the uploaded files. Set the backend URL in your frontend's backend configuration to `http://localhost:8080`. If the existing `js/api.js` uses different request field names, adjust that adapter to send the JSON shown above. The HTML alone cannot call these endpoints unless its JavaScript calls `fetch()`.

CORS is enabled for local development. Before public deployment, restrict allowed origins and add authentication/authorization. Never expose production database credentials in frontend JavaScript.
