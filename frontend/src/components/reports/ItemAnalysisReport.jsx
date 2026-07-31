import React, { useEffect, useState } from "react";
import api from "../../api";
import { downloadFileFromApi } from "../../utils/downloadFile";
import LoadingScreen from "../LoadingScreen";

const slugify = (label) => (label || "").toLowerCase().replace(/\s+/g, "-");

/** Difficulty index, discrimination index, and per-choice distractor efficiency for one quiz session. */
const ItemAnalysisReport = ({ token, quizId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedItemId, setExpandedItemId] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await api.get(`/quizzes/${quizId}/item-analysis/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setData(res.data);
            } catch (err) {
                setError("Failed to load the item analysis report.");
            } finally {
                setLoading(false);
            }
        };
        if (quizId) fetchReport();
    }, [quizId, token]);

    const handleDownloadPdf = () => {
        downloadFileFromApi(api, `/quizzes/${quizId}/item-analysis/pdf/`, {
            token,
            filename: `item_analysis_${quizId}.pdf`,
        });
    };

    if (loading) return <LoadingScreen message="Loading item analysis..." fullPage={false} />;
    if (error) return <p className="topic-meta-text text-danger">{error}</p>;
    if (!data) return null;

    return (
        <div className="analytics-section-block">
            <h3>Item Analysis</h3>
            <button onClick={handleDownloadPdf} className="submit-button edit-btn">
                📄 Download PDF
            </button>
            <p className="topic-meta-text">
                Based on {data.completed_attempts} completed attempt{data.completed_attempts === 1 ? "" : "s"}.
                {data.insufficient_data_for_discrimination && " Discrimination index needs at least 2 completed attempts."}
            </p>

            {data.items.length === 0 ? (
                <p className="topic-meta-text">This quiz has no items.</p>
            ) : (
                <div className="tos-table-scroll">
                    <table className="analytics-topic-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Topic</th>
                                <th>Difficulty (p)</th>
                                <th>Discrimination (D)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item) => (
                                <React.Fragment key={item.flashcard_id}>
                                    <tr>
                                        <td>{item.question}</td>
                                        <td>{item.sub_topic}</td>
                                        <td>
                                            {item.difficulty_index}
                                            <span className={`report-badge report-badge-${slugify(item.difficulty_label)}`}>
                                                {item.difficulty_label}
                                            </span>
                                        </td>
                                        <td>
                                            {item.discrimination_index === null ? (
                                                "—"
                                            ) : (
                                                <>
                                                    {item.discrimination_index}
                                                    <span className={`report-badge report-badge-${slugify(item.discrimination_label)}`}>
                                                        {item.discrimination_label}
                                                    </span>
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="submit-button edit-btn"
                                                onClick={() =>
                                                    setExpandedItemId(expandedItemId === item.flashcard_id ? null : item.flashcard_id)
                                                }
                                            >
                                                {expandedItemId === item.flashcard_id ? "Hide" : "Distractors"}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedItemId === item.flashcard_id && (
                                        <tr>
                                            <td colSpan={5}>
                                                <table className="analytics-topic-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Choice</th>
                                                            <th>Text</th>
                                                            <th>Correct?</th>
                                                            <th>Chosen (n / %)</th>
                                                            <th>Upper Group</th>
                                                            <th>Lower Group</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {item.distractors.map((d) => (
                                                            <tr key={d.choice}>
                                                                <td>{d.choice}</td>
                                                                <td>{d.text}</td>
                                                                <td>{d.is_correct ? "✓" : ""}</td>
                                                                <td>
                                                                    {d.count} / {d.percentage}%
                                                                    {d.flagged_non_functional && (
                                                                        <span className="report-badge report-badge-poor">Non-functional</span>
                                                                    )}
                                                                </td>
                                                                <td>{d.upper_count}</td>
                                                                <td>{d.lower_count}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ItemAnalysisReport;
