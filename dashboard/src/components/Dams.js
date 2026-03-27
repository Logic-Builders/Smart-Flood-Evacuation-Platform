import React from "react";
import dams from "../data/dams";

function Dams() {
  return (
    <div>
      <h2>Dam Warnings</h2>

      {dams.map((d, i) => (
        <div key={i} className="card">
          <h4>{d.name}</h4>
          <p>{d.note}</p>
          <p>Level: {d.level}%</p>
        </div>
      ))}
    </div>
  );
}

export default Dams;