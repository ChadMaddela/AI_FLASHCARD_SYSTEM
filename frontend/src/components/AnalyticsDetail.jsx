import React from "react";

const CONFIDENCE_LABELS = {
  GUESSING: "Guessing",
  UNSURE: "Unsure",
  CONFIDENT: "Confident",
};

/** Renders one analytics payload (stat tiles + mastery distribution + topic/confidence breakdown tables). */
const AnalyticsDetail = ({ data }) => {
  if (!data) return null;

  return (
    <>
      <div className="analytics-metrics-grid analytics-grid-standalone">
        <div className="metric-box">
          <span className="metric-label">Cards Seen</span>
          <span className="metric-val">{data.cards_seen}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Cards Mastered</span>
          <span className="metric-val">{data.cards_mastered}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Cards Due Now</span>
          <span className="metric-val">{data.cards_due}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Overall Accuracy</span>
          <span className="metric-val">{data.accuracy_percentage}%</span>
        </div>
      </div>

      <div className="analytics-section-block">
        <h3>Mastery Distribution</h3>
        <div className="mastery-distribution-list">
          {data.mastery_distribution.map((row) => (
            <div className="mastery-distribution-row" key={row.mastery_level}>
              <span className="mastery-distribution-label">Level {row.mastery_level}</span>
              <span className="mastery-distribution-count">{row.count} card{row.count === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-section-block">
        <h3>Breakdown by Sub-topic</h3>
        {data.topic_breakdown.length === 0 ? (
          <p className="topic-meta-text">No sub-topic data yet.</p>
        ) : (
          <table className="analytics-topic-table">
            <thead>
              <tr>
                <th>Sub-topic</th>
                <th>Avg. Mastery</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {data.topic_breakdown.map((row) => (
                <tr key={row.sub_topic}>
                  <td>{row.sub_topic}</td>
                  <td>{row.avg_mastery}</td>
                  <td>{row.accuracy_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.confidence_breakdown && (
        <div className="analytics-section-block">
          <h3>Confidence Calibration</h3>
          {data.confidence_breakdown.length === 0 ? (
            <p className="topic-meta-text">No confidence ratings yet.</p>
          ) : (
            <table className="analytics-topic-table">
              <thead>
                <tr>
                  <th>Confidence Level</th>
                  <th>Times Rated</th>
                  <th>Accuracy When Rated This Way</th>
                </tr>
              </thead>
              <tbody>
                {data.confidence_breakdown.map((row) => (
                  <tr key={row.confidence}>
                    <td>{CONFIDENCE_LABELS[row.confidence] || row.confidence}</td>
                    <td>{row.total}</td>
                    <td>{row.accuracy_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
};

export default AnalyticsDetail;
