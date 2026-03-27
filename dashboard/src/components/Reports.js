import React from "react";
import reports from "../data/reports";

function Reports() {
  return (
    <div>
      <h2>User Reports</h2>

      {reports.map((r) => (
        <div key={r.id} className="card">
          <h4>{r.loc}</h4>
          <p>{r.desc}</p>
          <button>Approve</button>
          <button>Reject</button>
        </div>
      ))}
    </div>
  );
}

export default Reports;