package com.vegam.traffic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TrafficController {
  private final JdbcTemplate db;
  public TrafficController(JdbcTemplate db) { this.db = db; }

  @GetMapping("/health")
  public Map<String,Object> health() {
    Integer count = db.queryForObject("SELECT COUNT(*) FROM junctions", Integer.class);
    return Map.of("status","UP","service","Smart Traffic Backend","junctions",count);
  }

  @GetMapping("/network/junctions")
  public List<Map<String,Object>> junctions() {
    return db.queryForList("SELECT id, name FROM junctions ORDER BY id");
  }

  @GetMapping("/network/roads")
  public List<Map<String,Object>> roads() {
    return db.queryForList("SELECT id, source_id AS source, destination_id AS destination, distance_km AS distanceKm, base_speed_kmh AS baseSpeedKmh, traffic_level AS trafficLevel, closed FROM roads ORDER BY id");
  }

  @PostMapping("/routes/find")
  public Map<String,Object> findRoute(@RequestBody RouteRequest req) {
    String src = norm(req.source()), dst = norm(req.destination());
    requireJunction(src); requireJunction(dst);
    if (src.equals(dst)) return Map.of("vehicleType", safeType(req.vehicleType()), "source",src,"destination",dst,"route",List.of(src),"distanceKm",0,"estimatedTicks",0,"segments",List.of());
    List<Map<String,Object>> edges = db.queryForList("SELECT source_id,destination_id,distance_km,base_speed_kmh,traffic_level,closed FROM roads WHERE closed=FALSE");
    Map<String,List<Edge>> graph = new HashMap<>();
    for (Map<String,Object> row : edges) {
      String a=(String)row.get("source_id"), b=(String)row.get("destination_id");
      double distance=((Number)row.get("distance_km")).doubleValue();
      double speed=((Number)row.get("base_speed_kmh")).doubleValue();
      String traffic=(String)row.get("traffic_level");
      double factor = switch(traffic) { case "MODERATE" -> 1.5; case "HEAVY" -> 2.5; default -> 1.0; };
      double cost = distance / Math.max(1.0,speed) * 60.0 * factor;
      graph.computeIfAbsent(a,k->new ArrayList<>()).add(new Edge(a,b,distance,speed,traffic,cost));
    }
    Map<String,Double> dist = new HashMap<>(); Map<String,Edge> prev = new HashMap<>();
    PriorityQueue<NodeCost> pq = new PriorityQueue<>(Comparator.comparingDouble(NodeCost::cost));
    dist.put(src,0.0); pq.add(new NodeCost(src,0.0));
    while(!pq.isEmpty()) {
      NodeCost current=pq.poll();
      if(current.cost()>dist.getOrDefault(current.node(),Double.POSITIVE_INFINITY)) continue;
      if(current.node().equals(dst)) break;
      for(Edge e:graph.getOrDefault(current.node(),List.of())) {
        double next=current.cost()+e.cost();
        if(next<dist.getOrDefault(e.to(),Double.POSITIVE_INFINITY)) {
          dist.put(e.to(),next); prev.put(e.to(),e); pq.add(new NodeCost(e.to(),next));
        }
      }
    }
    if(!dist.containsKey(dst)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No open route between the selected junctions.");
    List<Edge> pathEdges=new ArrayList<>(); String cursor=dst;
    while(!cursor.equals(src)) { Edge e=prev.get(cursor); if(e==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Route unavailable"); pathEdges.add(e); cursor=e.from(); }
    Collections.reverse(pathEdges);
    List<String> path=new ArrayList<>(); path.add(src); double km=0;
    List<Map<String,Object>> segments=new ArrayList<>();
    for(Edge e:pathEdges) {
      path.add(e.to()); km+=e.distance();
      segments.add(Map.of("from",e.from(),"to",e.to(),"distanceKm",e.distance(),"baseSpeedKmh",e.speed(),"trafficLevel",e.traffic(),"cost",round(e.cost())));
    }
    return Map.of("vehicleType",safeType(req.vehicleType()),"source",src,"destination",dst,"route",path,"distanceKm",round(km),"estimatedTicks",round(dist.get(dst)),"segments",segments);
  }

  @PostMapping("/traffic/generate")
  public Map<String,Object> generate(@RequestBody(required=false) Map<String,Object> body) {
    int count=6;
    if(body!=null && body.get("count") instanceof Number n) count=Math.max(3,Math.min(10,n.intValue()));
    List<Map<String,Object>> nodes=db.queryForList("SELECT id FROM junctions ORDER BY id");
    List<Map<String,Object>> generated=new ArrayList<>();
    Random random=new Random();
    for(int i=0;i<count;i++) {
      String src=(String)nodes.get(random.nextInt(nodes.size())).get("id");
      String dst=(String)nodes.get(random.nextInt(nodes.size())).get("id");
      if(src.equals(dst)) dst=(String)nodes.get((Integer.parseInt(src.substring(1))%nodes.size())).get("id");
      String id="AUTO-"+UUID.randomUUID().toString().substring(0,8).toUpperCase();
      Map<String,Object> route=findRoute(new RouteRequest("NORMAL",src,dst));
      db.update("INSERT INTO vehicles(id,vehicle_type,source_id,destination_id,route_json,distance_km,estimated_ticks,status) VALUES(?,?,?,?,?,?,?,'SCHEDULED')",
        id,"NORMAL",src,dst,String.join(" -> ",(List<String>)route.get("route")),route.get("distanceKm"),route.get("estimatedTicks"));
      generated.add(Map.of("id",id,"vehicleType","NORMAL","source",src,"destination",dst,"route",route.get("route"),"distanceKm",route.get("distanceKm"),"estimatedTicks",route.get("estimatedTicks"),"status","SCHEDULED"));
    }
   String eventJunction =
    (String) generated.get(0).get("source");

log("TRAFFIC_GENERATED",
    "Generated " + count + " traffic vehicles",
    eventJunction);

return Map.of("count", count, "vehicles", generated);
}

  @PostMapping("/emergency/request")
  public Map<String,Object> emergency(@RequestBody EmergencyRequest req) {
    String id = req.id()==null || req.id().isBlank() ? "EMG-"+UUID.randomUUID().toString().substring(0,8).toUpperCase() : req.id().trim();
    String type=safeType(req.vehicleType());
    if(type.equals("NORMAL")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Emergency type must be AMBULANCE, FIRE_TRUCK or POLICE.");
    Map<String,Object> route=findRoute(new RouteRequest(type,req.source(),req.destination()));
    String routeText=String.join(" -> ",(List<String>)route.get("route"));
    db.update("INSERT INTO vehicles(id,vehicle_type,source_id,destination_id,route_json,distance_km,estimated_ticks,status) VALUES(?,?,?,?,?,?,?,'DISPATCHED')",
      id,type,norm(req.source()),norm(req.destination()),routeText,route.get("distanceKm"),route.get("estimatedTicks"));
    List<String> corridor=(List<String>)route.get("route");
    for(String junction:corridor) db.update("INSERT INTO signal_states(junction_id,phase,priority_vehicle_id) VALUES(?,'EMERGENCY',?) ON DUPLICATE KEY UPDATE phase='EMERGENCY',priority_vehicle_id=VALUES(priority_vehicle_id)",junction,id);
    log("EMERGENCY_DISPATCH",id+" dispatched: "+routeText,norm(req.source()));
    return Map.of("id",id,"vehicleType",type,"source",norm(req.source()),"destination",norm(req.destination()),"route",corridor,"distanceKm",route.get("distanceKm"),"estimatedTicks",route.get("estimatedTicks"),"greenCorridor",true,"status","DISPATCHED");
  }

  @GetMapping("/signals")
  public List<Map<String,Object>> signals() {
    return db.queryForList("SELECT j.id AS junctionId,j.name,s.phase,s.priority_vehicle_id AS priorityVehicleId,s.updated_at AS updatedAt FROM junctions j LEFT JOIN signal_states s ON s.junction_id=j.id ORDER BY j.id");
  }

  @PostMapping("/roads/update")
  public Map<String,Object> updateRoad(@RequestBody RoadUpdate req) {
    String a=norm(req.source()),b=norm(req.destination());
    int changed=db.update("UPDATE roads SET closed=?,traffic_level=? WHERE source_id=? AND destination_id=?",req.closed(),safeTraffic(req.trafficLevel()),a,b);
    if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Road segment not found.");
    log("ROAD_UPDATE",a+" -> "+b+" closed="+req.closed()+", traffic="+safeTraffic(req.trafficLevel()),a);
    return Map.of("updated",true,"source",a,"destination",b,"closed",req.closed(),"trafficLevel",safeTraffic(req.trafficLevel()));
  }

  @GetMapping("/vehicles")
  public List<Map<String,Object>> vehicles() { return db.queryForList("SELECT id,vehicle_type AS vehicleType,source_id AS source,destination_id AS destination,route_json AS route,distance_km AS distanceKm,estimated_ticks AS estimatedTicks,status,created_at AS createdAt FROM vehicles ORDER BY created_at DESC"); }

  @GetMapping("/events")
  public List<Map<String,Object>> events() { return db.queryForList("SELECT id,event_type AS eventType,description,junction_id AS junctionId,created_at AS createdAt FROM traffic_events ORDER BY id DESC LIMIT 200"); }

  private void requireJunction(String id) {
    if(db.queryForList("SELECT id FROM junctions WHERE id=?",id).isEmpty())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown junction ID: "+id+" (use J1 to J12).");
  }
  private void log(String type,String description,String junction) {
    db.update("INSERT INTO traffic_events(event_type,description,junction_id) VALUES(?,?,?)",type,description,junction);
  }
  private String norm(String value) {
    if(value==null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Source and destination are required.");
    return value.trim().toUpperCase(Locale.ROOT);
  }
  private String safeType(String value) {
    String t=value==null?"NORMAL":value.trim().toUpperCase(Locale.ROOT);
    if(!Set.of("NORMAL","AMBULANCE","FIRE_TRUCK","POLICE").contains(t)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid vehicle type.");
    return t;
  }
  private String safeTraffic(String value) {
    String t=value==null?"LIGHT":value.trim().toUpperCase(Locale.ROOT);
    if(!Set.of("LIGHT","MODERATE","HEAVY").contains(t)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid traffic level.");
    return t;
  }
  private double round(double n) { return Math.round(n*100.0)/100.0; }
  public record RouteRequest(String vehicleType,String source,String destination) {}
  public record EmergencyRequest(String id,String vehicleType,String source,String destination) {}
  public record RoadUpdate(String source,String destination,boolean closed,String trafficLevel) {}
  private record Edge(String from,String to,double distance,double speed,String traffic,double cost) {}
  private record NodeCost(String node,double cost) {}
}
