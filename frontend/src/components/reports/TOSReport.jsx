import React, { useMemo, useState } from "react";
import api from "../../api";
import { downloadFileFromApi } from "../../utils/downloadFile";

const BLOOM_LEVEL_LABELS = {
    REMEMBERING: "Remembering",
    UNDERSTANDING: "Understanding",
    APPLYING: "Applying",
    ANALYZING: "Analyzing",
    EVALUATING: "Evaluating",
    CREATING: "Creating",
};
const BLOOM_LEVEL_ORDER = Object.keys(BLOOM_LEVEL_LABELS);

/** Table of Specifications: teacher enters ad-hoc hours-per-topic, backend returns ideal-vs-actual item counts + Bloom matrix. */
const TOSReport = ({ token, quizId, flashcards }) => {
    const topics = useMemo(() => {
        const set = new Set(flashcards.map((f) => f.sub_topic || "Uncategorized"));
        return Array.from(set).sort();
    }, [flashcards]);

    const [hours, setHours] = useState(() => Object.fromEntries(topics.map((t) => [t, ""])));
    const [result, setResult] = useState(null);
    const [lastSubmittedHours, setLastSubmittedHours] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleHourChange = (topic, value) => {
        setHours((prev) => ({ ...prev, [topic]: value }));
    };

    const handleGenerate = async () => {
        setError("");
        setLoading(true);
        try {
            const payloadHours = Object.fromEntries(
                Object.entries(hours)
                    .filter(([, v]) => v !== "" && v !== null)
                    .map(([k, v]) => [k, Number(v)])
            );
            const res = await api.post(
                `/quizzes/${quizId}/tos/`,
                { hours: payloadHours },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setResult(res.data);
            setLastSubmittedHours(payloadHours);
        } catch (err) {
            setResult(null);
            setError(err.response?.data?.error || "Failed to generate the Table of Specifications.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = () => {
        downloadFileFromApi(api, `/quizzes/${quizId}/tos/pdf/`, {
            method: "post",
            data: { hours: lastSubmittedHours },
            token,
            filename: `tos_${quizId}.pdf`,
        });
    };

    return (
        <div className="analytics-section-block">
            <h3>Table of Specifications</h3>
            <p className="topic-meta-text">
                Enter the number of hours spent teaching each topic. The ideal item count is
                computed from each topic's share of total teaching hours.
            </p>

            {topics.length === 0 ? (
                <p className="topic-meta-text">This material has no flashcards yet.</p>
            ) : (
                <>
                    <div className="tos-hours-input-grid">
                        {topics.map((topic) => (
                            <div className="form-field-block" key={topic}>
                                <label>{topic} (HOURS):</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="dark-input-box"
                                    value={hours[topic] ?? ""}
                                    onChange={(e) => handleHourChange(topic, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="submit-button create-btn">
                        {loading ? "⏳ Generating..." : "📐 Generate TOS"}
                    </button>
                </>
            )}

            {error && <p className="topic-meta-text text-danger">{error}</p>}

            {result && (
                <div className="tos-result-wrapper">
                    <button onClick={handleDownloadPdf} className="submit-button edit-btn">
                        📄 Download PDF
                    </button>
                    <div className="analytics-metrics-grid analytics-grid-standalone">
                        <div className="metric-box">
                            <span className="metric-label">Total Items</span>
                            <span className="metric-val">{result.total_items}</span>
                        </div>
                        <div className="metric-box">
                            <span className="metric-label">Total Hours</span>
                            <span className="metric-val">{result.total_hours}</span>
                        </div>
                    </div>

                    <div className="tos-table-scroll">
                        <table className="analytics-topic-table">
                            <thead>
                                <tr>
                                    <th>Topic</th>
                                    <th>Hours</th>
                                    <th>% Weight</th>
                                    <th>Ideal Items</th>
                                    <th>Actual Items</th>
                                    {BLOOM_LEVEL_ORDER.map((level) => (
                                        <th key={level}>{BLOOM_LEVEL_LABELS[level]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.topics.map((row) => (
                                    <tr key={row.sub_topic}>
                                        <td>{row.sub_topic}</td>
                                        <td>{row.hours}</td>
                                        <td>{row.percentage_weight}%</td>
                                        <td>{row.ideal_item_count}</td>
                                        <td>
                                            {row.actual_item_count}
                                            {row.ideal_item_count > 0 && row.actual_item_count === 0 && (
                                                <span className="report-badge report-badge-poor">Gap</span>
                                            )}
                                        </td>
                                        {BLOOM_LEVEL_ORDER.map((level) => (
                                            <td key={level}>{row.bloom_breakdown[level] ?? 0}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TOSReport;
