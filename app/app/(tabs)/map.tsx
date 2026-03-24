import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MapView, { Marker, Polyline, Polygon, Region, UrlTile } from "react-native-maps";
import * as Location from "expo-location";

type Coordinate = { latitude: number; longitude: number };

type FloodZone = {
  id: string;
  gauge_id: string;
  severity: "NORMAL" | "WATCH" | "WARNING" | "EXTREME";
  boundary: { coordinates: Coordinate[] };
};

type Report = {
  id: string;
  location: Coordinate;
  report_type: "FLOODED_ROAD" | "DAMAGED_BRIDGE" | "BLOCKED_ROAD";
  severity: number;
  description: string;
  expires_at: string;
};

const API_BASE = "http://10.10.11.136:8080"; // your PC LAN IP

export default function MapScreen() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [floodZones, setFloodZones] = useState<FloodZone[]>([]);
  const [activeReports, setActiveReports] = useState<Report[]>([]);
  const [region, setRegion] = useState<Region>({
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  useEffect(() => {
    fetchFloodZones();
    fetchActiveReports();
  }, []);

  const fetchFloodZones = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/flood-zones`);
      const data = await res.json();
      setFloodZones(data.data.zones);
    } catch (err) {
      console.error("Fetch Flood Zones Error:", err);
      // Mock data if backend not ready
      setFloodZones([
        {
          id: "1",
          gauge_id: "LK_KELANI_001",
          severity: "WARNING",
          boundary: {
            coordinates: [
              { latitude: 7.8731, longitude: 80.7718 },
              { latitude: 7.8800, longitude: 80.7600 },
              { latitude: 7.8650, longitude: 80.7650 },
            ],
          },
        },
      ]);
    }
  };

  const fetchActiveReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/reports/active`);
      const data = await res.json();
      setActiveReports(data.data.reports);
    } catch (err) {
      console.error("Fetch Active Reports Error:", err);
      // Mock report
      setActiveReports([
        {
          id: "r1",
          location: { latitude: 7.874, longitude: 80.770 },
          report_type: "FLOODED_ROAD",
          severity: 4,
          description: "Road flooded near Kandy lake",
          expires_at: "2025-03-09T06:00:00Z",
        },
      ]);
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Allow location access to calculate route");
      return false;
    }
    return true;
  };

  // Check if a point is inside any flood zone
  const isSafe = (coord: Coordinate) => {
    for (let zone of floodZones) {
      const lats = zone.boundary.coordinates.map((z) => z.latitude);
      const lngs = zone.boundary.coordinates.map((z) => z.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      if (
        coord.latitude >= minLat &&
        coord.latitude <= maxLat &&
        coord.longitude >= minLng &&
        coord.longitude <= maxLng
      ) {
        return false;
      }
    }
    return true;
  };

  // Get route from OSRM API
  const getRoute = async (startCoord: Coordinate, endCoord: Coordinate) => {
    try {
      const url = `http://router.project-osrm.org/route/v1/driving/${startCoord.longitude},${startCoord.latitude};${endCoord.longitude},${endCoord.latitude}?geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));
      }
      return [];
    } catch (err) {
      console.error("OSRM Routing Error:", err);
      return [];
    }
  };

  const calculateRoute = async () => {
    if (!start || !end) return Alert.alert("Error", "Enter start & end locations");

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    try {
      const startLoc = await Location.geocodeAsync(start);
      const endLoc = await Location.geocodeAsync(end);

      if (!startLoc.length || !endLoc.length)
        return Alert.alert("Error", "Invalid start or end location");

      const startCoord = startLoc[0];
      const endCoord = endLoc[0];

      // Get road-based route from OSRM
      let route = await getRoute(startCoord, endCoord);

      // Filter out unsafe points
      route = route.filter(isSafe);

      if (!route.length) {
        return Alert.alert("No Safe Route", "The path intersects flooded areas");
      }

      setRouteCoords(route);
      setRegion({
        latitude: route[0].latitude,
        longitude: route[0].longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to calculate route");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} region={region}>
        {/* OpenStreetMap Tiles */}
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {/* Safe Route */}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="blue" strokeWidth={4} />
        )}

        {/* Flood Zones */}
        {floodZones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.boundary.coordinates}
            fillColor="rgba(255,0,0,0.3)"
            strokeColor="red"
            strokeWidth={2}
          />
        ))}

        {/* Active Reports */}
        {activeReports.map((report) => (
          <Marker
            key={report.id}
            coordinate={report.location}
            title={report.report_type}
            description={report.description}
            pinColor={report.severity >= 4 ? "red" : "orange"}
          />
        ))}
      </MapView>

      {/* Input Panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          position: "absolute",
          top: 40,
          left: 20,
          right: 20,
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 12,
          padding: 15,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <TextInput
          placeholder="Start Location"
          value={start}
          onChangeText={setStart}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
          }}
        />
        <TextInput
          placeholder="Destination"
          value={end}
          onChangeText={setEnd}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            marginBottom: 15,
          }}
        />
        <TouchableOpacity
          onPress={calculateRoute}
          style={{
            backgroundColor: "#1D4ED8",
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
            Show Safe Route
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}