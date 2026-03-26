import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  UrlTile,
} from "react-native-maps";
import * as Location from "expo-location";

type Coordinate = { latitude: number; longitude: number };

export default function MapScreen() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"start" | "end" | null>(null);

  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [floodZones, setFloodZones] = useState<any[]>([]);
  const [activeReports, setActiveReports] = useState<any[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  const [steps, setSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);

  const [region, setRegion] = useState({
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  useEffect(() => {
    requestLocation();
    fetchFloodZones();
    fetchActiveReports();
  }, []);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        const coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coord);
      }
    );
  };

  const fetchFloodZones = async () => {
    try {
      const res = await fetch("http://10.10.11.136:8080/api/v1/flood-zones");
      const data = await res.json();
      setFloodZones(data.data.zones);
    } catch {}
  };

  const fetchActiveReports = async () => {
    try {
      const res = await fetch("http://10.10.11.136:8080/api/v1/reports/active");
      const data = await res.json();
      setActiveReports(data.data.reports);
    } catch {}
  };

  const searchLocation = async (text: string) => {
    if (text.length < 3) return setSuggestions([]);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${text}`
    );
    const data = await res.json();
    setSuggestions(data);
  };

  const selectSuggestion = (item: any) => {
    if (activeInput === "start") setStart(item.display_name);
    else setEnd(item.display_name);
    setSuggestions([]);
  };

  const centerOnUser = () => {
    if (!userLocation) return;
    setRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  const calculateRoute = async () => {
    if (!start || !end) return Alert.alert("Error", "Enter start & end");

    setLoadingRoute(true);

    try {
      const startLoc = await Location.geocodeAsync(start);
      const endLoc = await Location.geocodeAsync(end);

      const s = startLoc[0];
      const e = endLoc[0];

      const url = `https://router.project-osrm.org/route/v1/driving/${s.longitude},${s.latitude};${e.longitude},${e.latitude}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      const data = await res.json();

      const route = data.routes[0];

      setDistance(route.distance);
      setDuration(route.duration);

      let coords = route.geometry.coordinates.map(([lng, lat]: any) => ({
        latitude: lat,
        longitude: lng,
      }));

      coords = coords.filter((p: Coordinate) => {
        return !floodZones.some((zone) => {
          const lats = zone.boundary.coordinates.map((z: any) => z.latitude);
          const lngs = zone.boundary.coordinates.map((z: any) => z.longitude);
          return (
            p.latitude >= Math.min(...lats) &&
            p.latitude <= Math.max(...lats) &&
            p.longitude >= Math.min(...lngs) &&
            p.longitude <= Math.max(...lngs)
          );
        });
      });

      setRouteCoords(coords);
      setSteps(route.legs[0].steps);
      setCurrentStep(0);

    } catch {
      Alert.alert("Error", "Route failed");
    }

    setLoadingRoute(false);
  };

  useEffect(() => {
    if (!userLocation || steps.length === 0) return;

    const step = steps[currentStep];
    const next = step.maneuver.location;

    const dist =
      Math.sqrt(
        Math.pow(userLocation.latitude - next[1], 2) +
        Math.pow(userLocation.longitude - next[0], 2)
      ) * 111000;

    if (dist < 50 && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [userLocation]);

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} region={region} showsUserLocation>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {userLocation && <Marker coordinate={userLocation} title="You" />}

        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="blue" strokeWidth={5} />
        )}

        {floodZones.map((z) => (
          <Polygon key={z.id} coordinates={z.boundary.coordinates} fillColor="rgba(255,0,0,0.3)" />
        ))}

        {activeReports.map((r) => (
          <Marker key={r.id} coordinate={r.location} />
        ))}
      </MapView>

      <View style={{
        position: "absolute",
        top: 40,
        left: 10,
        right: 10,
        backgroundColor: "white",
        borderRadius: 10,
        padding: 10,
      }}>
        <TextInput
          placeholder="Start location"
          value={start}
          onChangeText={(t) => {
            setStart(t);
            setActiveInput("start");
            searchLocation(t);
          }}
        />

        <TextInput
          placeholder="Destination"
          value={end}
          onChangeText={(t) => {
            setEnd(t);
            setActiveInput("end");
            searchLocation(t);
          }}
        />

        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectSuggestion(item)}>
                <Text>{item.display_name}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity
          onPress={calculateRoute}
          style={{
            backgroundColor: "blue",
            padding: 10,
            marginTop: 10,
            borderRadius: 8,
          }}
        >
          {loadingRoute ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", textAlign: "center" }}>
              Show Route
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "white",
        padding: 15,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}>
        {steps.length > 0 && (
          <>
            <Text style={{ fontWeight: "bold" }}>
              Next: {steps[currentStep]?.maneuver?.instruction || "Continue"}
            </Text>
            <Text>Distance: {(distance / 1000).toFixed(2)} km</Text>
            <Text>ETA: {(duration / 60).toFixed(0)} mins</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        onPress={centerOnUser}
        style={{
          position: "absolute",
          bottom: 100,
          right: 20,
          backgroundColor: "white",
          padding: 12,
          borderRadius: 50,
        }}
      >
        <Text>📍</Text>
      </TouchableOpacity>
    </View>
  );
}