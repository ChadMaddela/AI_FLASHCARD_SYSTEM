import React, { useEffect, useState } from "react";
import api from "../../api";
import { downloadFileFromApi } from "../../utils/downloadFile";
import LoadingScreen from "../LoadingScreen";

const slugify = (label) => (label || "").toLowerCase().replace(/\s+/g, "-");

/** Per-topic mastery report (DepEd Mean Percentage Score scale) for one quiz session. */
const CompetencyMasteryReport = ({ token, quizId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedTopic, setExpandedTopic] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await api.get(`/quizzes/${quizId}/competency-mastery/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setData(res.data);
            } catch (err) {
                setError("Failed to load the competency mastery report.");
            } finally {
                setLoading(false);
            }
        };
        if (quizId) fetchReport();
    }, [quizId, token]);

    const handleDownloadPdf = () => {
        downloadFileFromApi(api, `/quizzes/${quizId}/competency-mastery/pdf/`, {
            token,
            filename: `competency_mastery_${quizId}.pdf`,
        });
    };

    if (loading) return <LoadingScreen message="Loading competency mastery report..." fullPage={false} />;
    if (error) return <p className="topic-meta-text text-danger">{error}</p>;
    if (!data) return null;

    return (
        <div className="analytics-section-block">
            <h3>Competency Mastery Report</h3>
            <button onClick={handleDownloadPdf} className="submit-button edit-btn">
                📄 Download PDF
            </button>
            <p className="topic-meta-text">
                Based on {data.completed_attempts} completed attempt{data.completed_attempts === 1 ? "" : "s"}.
            </p>

            {data.topics.length === 0 ? (
                <p className="topic-meta-text">This quiz has no items.</p>
            ) : (
                <table className="analytics-topic-table">
                    <thead>
                        <tr>
                            <th>Topic (Competency)</th>
                            <th>Items</th>
                            <th>Avg. Score</th>
                            <th>Mastery Level</th>
                            <th>Below Mastery</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.topics.map((topic) => (
                            <React.Fragment key={topic.sub_topic}>
                                <tr>
                                    <td>{topic.sub_topic}</td>
                                    <td>{topic.item_count}</td>
                                    <td>{topic.avg_score_percentage}%</td>
                                    <td>
                                        <span className={`report-badge report-badge-${slugify(topic.mastery_level)}`}>
                                            {topic.mastery_level}
                                        </span>
                                    </td>
                                    <td>
                                        {topic.students_below_mastery.length === 0 ? (
                                            "None"
                                        ) : (
                                            <button
                                                className="submit-button edit-btn"
                                                onClick={() =>
                                                    setExpandedTopic(expandedTopic === topic.sub_topic ? null : topic.sub_topic)
                                                }
                                            >
                                                {expandedTopic === topic.sub_topic ? "Hide" : `${topic.students_below_mastery.length} student(s)`}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedTopic === topic.sub_topic && (
                                    <tr>
                                        <td colSpan={5}>
                                            <ul className="mastery-remediation-list">
                                                {topic.students_below_mastery.map((s) => (
                                                    <li key={s.student_id}>
                                                        {s.username} — {s.score_percentage}%
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default CompetencyMasteryReport;
