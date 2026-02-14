# Smart-Flood-Evacuation-Platform
#Github repository structure
smart-flood-evacuation-platform/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── route_api.py
│   │   │   ├── report_api.py
│   │   │   ├── alert_api.py
│   │   │
│   │   ├── services/
│   │   │   ├── routing_service.py
│   │   │   ├── risk_engine.py
│   │   │   ├── alert_service.py
│   │   │
│   │   ├── models/
│   │   │   ├── route_model.py
│   │   │   ├── report_model.py
│   │   │
│   │   ├── data/
│   │   │   ├── sample_roads.json
│   │   │   ├── sample_risk_zones.json
│   │   │
│   │   └── config.py
│   │
│   ├── requirements.txt
│   ├── .env
│   └── README.md
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   │
│   └── package.json
│
├── docs/
│   ├── architecture_diagram.png
│   ├── api_documentation.md
│   └── system_design.md
│
├── .gitignore
└── README.md
