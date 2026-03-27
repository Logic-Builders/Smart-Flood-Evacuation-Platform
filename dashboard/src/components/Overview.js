import React from "react";

function Overview() {
  return (
    <div>
      <h2>Dashboard Overview</h2>

      <div className="cards">
        <div className="card red">Critical Zones: 3</div>
        <div className="card yellow">Reports: 7</div>
        <div className="card orange">Areas: 12</div>
        <div className="card green">Safe Routes: 28</div>
      </div>
    </div>
  );
}

export default Overview;