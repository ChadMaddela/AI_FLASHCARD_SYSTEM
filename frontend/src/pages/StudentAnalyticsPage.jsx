import React, { useEffect, useState, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import AnalyticsDetail from "../components/AnalyticsDetail";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/Dashboard.css";

const StudentAnalyticsPage = () => {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get("/analytics/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchAnalytics();
  }, [token]);

  if (loading) return <LoadingScreen message="Loading analytics..." />;
  if (!data) return <div className="dashboard-hub-wrapper"><p>Could not load analytics.</p></div>;

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <h2>My Learning Analytics</h2>
        <p>A snapshot of your progress across every flashcard you've reviewed.</p>
      </div>

      <AnalyticsDetail data={data} />
    </div>
  );
};

export default StudentAnalyticsPage;
