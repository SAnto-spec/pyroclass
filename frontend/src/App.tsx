import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { Anomalies } from "./pages/Anomalies";
import { Facilities } from "./pages/Facilities";
import { Sources } from "./pages/Sources";
import { Alerts } from "./pages/Alerts";

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="anomalies" element={<Anomalies />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="sources" element={<Sources />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
