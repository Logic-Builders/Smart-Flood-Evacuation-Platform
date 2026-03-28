// dashboard/src/components/Pages/index.js
// Named re-exports that match what App.jsx imports:
//   import { Overview, Reports, Weather, Dams, FloodMap, System } from './components/Pages'

export { default as Overview  } from "./Overview";
export { default as Reports   } from "./Reports";
export { default as Weather   } from "./Weather";
export { default as Dams      } from "./Dams";
export { default as FloodMap  } from "./Map";      // Map.jsx exports function FloodMap
export { default as System    } from "./System";
