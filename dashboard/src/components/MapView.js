import React, { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapView() {
  useEffect(() => {
    const map = L.map("map").setView([6.9271, 79.8612], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
      .addTo(map);

    return () => map.remove();
  }, []);

  return <div id="map" style={{ height: "400px" }} />;
}

export default MapView;