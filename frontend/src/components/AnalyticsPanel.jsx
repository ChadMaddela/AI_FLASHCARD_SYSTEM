import React from "react";

const AnalyticsPanel = ({ analytics }) => (
  <div>
    <h3>Analytics</h3>
    <p>Mastery Level: {analytics.updated_mastery_level}</p>
    <p>Total Attempts: {analytics.total_attempts}</p>
    <p>Accuracy: {analytics.accuracy_percentage}%</p>
    <p>Sub-topic: {analytics.sub_topic_tracked}</p>
  </div>
);

export default AnalyticsPanel;
