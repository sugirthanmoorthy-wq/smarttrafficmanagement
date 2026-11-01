Smart Traffic frontend JavaScript integration

1. Copy the entire `js` folder into your website folder:
   E:\xampp\htdocs\s\js\
2. Your `index.html` references `css/style.css`. Make sure your stylesheet is located at:
   E:\xampp\htdocs\s\css\style.css
   If style.css is currently directly in the s folder, either move it into css\ or change the stylesheet link in index.html to href="style.css".
3. Keep the Spring Boot backend running on http://localhost:8080.
4. Open the frontend via XAMPP at http://localhost/s/ (not by double-clicking index.html).
5. The scripts use the existing API endpoints and MySQL-backed controller. They do not connect the browser directly to MySQL.
6. Emergency dispatch, route lookup, traffic generation, road updates, signals and events are wired to the current backend endpoints.
7. This is an initial integration layer. The existing controller does not expose APIs for all advanced frontend simulation features (for example true tick-by-tick movement/FIFO conflict simulation), so those features are not simulated by this layer.
