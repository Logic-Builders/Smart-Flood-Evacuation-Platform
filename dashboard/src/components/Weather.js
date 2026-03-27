import React from "react";
import weatherData from "../data/weather";

function Weather() {
  return (
    <div>
      <h2>Weather Data</h2>

      <table>
        <thead>
          <tr>
            <th>District</th>
            <th>Rainfall</th>
            <th>Risk</th>
          </tr>
        </thead>

        <tbody>
          {weatherData.map((w, i) => (
            <tr key={i}>
              <td>{w.district}</td>
              <td>{w.rainfall}</td>
              <td>{w.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Weather;