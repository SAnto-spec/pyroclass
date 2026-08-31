import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Skeleton } from "./components/ui/Skeleton";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Anomalies = lazy(() => import("./pages/Anomalies").then((m) => ({ default: m.Anomalies })));
const Facilities = lazy(() => import("./pages/Facilities").then((m) => ({ default: m.Facilities })));
const Sources = lazy(() => import("./pages/Sources").then((m) => ({ default: m.Sources })));
const Alerts = lazy(() => import("./pages/Alerts").then((m) => ({ default: m.Alerts })));
const MapPage = lazy(() => import("./pages/Map").then((m) => ({ default: m.MapPage })));
const Reports = lazy(() => import("./pages/Reports").then((m) => ({ default: m.Reports })) as never);

function App() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-[200px] w-full" /><Skeleton className="mt-3 h-10 w-full" /></div>}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="anomalies" element={<Anomalies />} />
          <Route path="anomalies/:anomalyId" element={<Anomalies />} />
          <Route path="facilities" element={<Facilities />} />
          <Route path="sources" element={<Sources />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="map" element={<MapPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ground-reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
