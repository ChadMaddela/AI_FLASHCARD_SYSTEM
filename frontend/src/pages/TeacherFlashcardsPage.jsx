import React, { useEffect, useState, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/MaterialsPage.css";

const TeacherFlashcardsPage = () => {
    const { token } = useContext(AuthContext);
    const { materialId } = useParams();
    const location = useLocation();

    const [flashcards, setFlashcards] = useState([]);
    const [materialTitle, setMaterialTitle] = useState(location.state?.materialTitle || "");
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    
    // UI Loading States
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Dynamic Centralized Alert Modal State
    const [alertModal, setAlertModal] = useState({
        show: false,
        type: "success", 
        title: "",
        message: ""
    });

    // Delete Confirmation Modal State
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        cardId: null
    });

    // Structured fields to keep our loop clean
    const [newFlashcard, setNewFlashcard] = useState({
        question: "", 
        choice_a: "", 
        choice_b: "", 
        choice_c: "",
        choice_d: "", 
        correct_choice: "", // Handled cleanly via radio selections now
        sub_topic: "",
    });

    useEffect(() => {
        const fetchPageData = async () => {
            setLoading(true);
            if (!materialTitle) {
                try {
                    const materialRes = await api.get(`/materials/${materialId}/`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    setMaterialTitle(materialRes.data?.title || `Material ${materialId}`);
                } catch (err) {
                    console.warn("Could not load explicit material title endpoint, using fallback.");
                    setMaterialTitle(`Material ${materialId}`);
                }
            }
            try {
                const flashcardsRes = await api.get(`/materials/${materialId}/flashcards/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setFlashcards(Array.isArray(flashcardsRes.data) ? flashcardsRes.data : []);
            } catch (err) {
                console.error("Failed to fetch flashcards data array:", err);
                setFlashcards([]);
            } finally {
                setLoading(false);
            }
        };

        if (token && materialId) {
            fetchPageData();
        }
    }, [materialId, token, materialTitle]);

    const handleInputChange = (e, stateSetter, state) => {
        const { name, value } = e.target;
        stateSetter({ ...state, [name]: value });
    };

    // --- CREATE ACTIONS ---
    const handleCreate = async () => {
        if (!newFlashcard.question || !newFlashcard.question.trim()) {
            setAlertModal({
                show: true,
                type: "error",
                title: "Missing Information",
                message: "Please provide at least a question title context."
            });
            return;
        }

        if (!newFlashcard.correct_choice) {
            setAlertModal({
                show: true,
                type: "error",
                title: "Select Correct Answer",
                message: "Please select which choice (A, B, C, or D) is the correct answer using the radio bubbles."
            });
            return;
        }

        setIsCreating(true);
        try {
            const payload = {
                question: newFlashcard.question,
                choice_a: newFlashcard.choice_a,
                choice_b: newFlashcard.choice_b,
                choice_c: newFlashcard.choice_c,
                choice_d: newFlashcard.choice_d,
                correct_choice: newFlashcard.correct_choice.toUpperCase().trim(),
                sub_topic: newFlashcard.sub_topic
            };

            const res = await api.post(`/materials/${materialId}/flashcards/create/`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setFlashcards([...flashcards, res.data]);
            setNewFlashcard({
                question: "", choice_a: "", choice_b: "", choice_c: "",
                choice_d: "", correct_choice: "", sub_topic: "",
            });

            setAlertModal({
                show: true,
                type: "success",
                title: "Flashcard Created 🎉",
                message: "Your new flashcard has been successfully added to this deck."
            });
        } catch (err) {
            console.error(err);
            setAlertModal({
                show: true,
                type: "error",
                title: "Creation Failed ❌",
                message: "Failed to create flashcard. Please check your data values and try again."
            });
        } finally {
            setIsCreating(false);
        }
    };

    // --- EDIT / SAVE ACTIONS ---
    const handleEdit = (flashcard) => {
        setEditingId(flashcard.id);
        setEditData({ ...flashcard });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.put(`/flashcards/${editingId}/update/`, editData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFlashcards(flashcards.map((f) => (f.id === editingId ? { ...editData } : f)));
            setEditingId(null);

            setAlertModal({
                show: true,
                type: "success",
                title: "Changes Saved 💾",
                message: "The flashcard has been successfully updated."
            });
        } catch (err) {
            console.error(err);
            setAlertModal({
                show: true,
                type: "error",
                title: "Update Failed ❌",
                message: "Could not save your adjustments. Please try again."
            });
        } finally {
            setIsSaving(false);
        }
    };

    // --- DELETE ACTIONS ---
    const triggerDeleteConfirmation = (id) => {
        setDeleteModal({ show: true, cardId: id });
    };

    const confirmDelete = async () => {
        const id = deleteModal.cardId;
        setDeleteModal({ show: false, cardId: null });
        setIsDeleting(true);
        
        try {
            await api.delete(`/flashcards/${id}/delete/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFlashcards(flashcards.filter((f) => f.id !== id));

            setAlertModal({
                show: true,
                type: "success",
                title: "Deleted Successfully 🗑️",
                message: "The selected flashcard has been completely removed from this deck."
            });
        } catch (err) {
            console.error(err);
            setAlertModal({
                show: true,
                type: "error",
                title: "Delete Failed ❌",
                message: "An error occurred while attempting to remove this item."
            });
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <div className="flashcards-container"><p>Loading flashcards...</p></div>;

    return (
        <div className="flashcards-container">
            <h2>Flashcards for {materialTitle || `Material ${materialId}`}</h2>
            <div className="flashcards-layout">
                
                {/* Create Form Sidebar */}
                <div className="new-flashcard-pane">
                    <h3>Create New Flashcard</h3>
                    <div className="form-grid">
                        
                        {/* 1. Question Block */}
                        <div className="form-field-block">
                            <label>QUESTION:</label>
                            <textarea
                                name="question"
                                disabled={isCreating}
                                rows={3}
                                className="dark-textarea"
                                value={newFlashcard.question}
                                onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                            />
                        </div>

                        {/* 2. Embedded Radio Choices Block (A, B, C, D) */}
                        <div className="form-field-block">
                            <label>CHOICES & CORRECT CORRECT ANSWER:</label>
                            <div className="choices-radio-group">
                                {[
                                    { key: "choice_a", letter: "A" },
                                    { key: "choice_b", letter: "B" },
                                    { key: "choice_c", letter: "C" },
                                    { key: "choice_d", letter: "D" }
                                ].map((choice) => (
                                    <div key={choice.key} className="embedded-choice-row">
                                        <label className="radio-label-wrapper">
                                            <input 
                                                type="radio" 
                                                name="correct_choice" 
                                                value={choice.letter}
                                                checked={newFlashcard.correct_choice === choice.letter}
                                                disabled={isCreating}
                                                onChange={(e) => setNewFlashcard({ ...newFlashcard, correct_choice: e.target.value })}
                                                className="hidden-radio-input"
                                            />
                                            <div className={`radio-custom-bubble ${newFlashcard.correct_choice === choice.letter ? "active-bubble-select" : ""}`}>
                                                {choice.letter}
                                            </div>
                                        </label>
                                        <input
                                            name={choice.key}
                                            type="text"
                                            disabled={isCreating}
                                            placeholder={`Type Choice ${choice.letter} here...`}
                                            className="dark-input-box choices-inline-input"
                                            value={newFlashcard[choice.key]}
                                            onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Sub Topic Field */}
                        <div className="form-field-block">
                            <label>SUB TOPIC:</label>
                            <input
                                name="sub_topic"
                                type="text"
                                disabled={isCreating}
                                placeholder="e.g., Chapter 1 Basics"
                                className="dark-input-box"
                                value={newFlashcard.sub_topic}
                                onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                            />
                        </div>

                    </div>
                    <button 
                        onClick={handleCreate} 
                        disabled={isCreating} 
                        className={`submit-button create-btn ${isCreating ? "btn-disabled" : ""}`}
                    >
                        {isCreating ? "⏳ Creating..." : "➕ Add Flashcard"}
                    </button>
                </div>

                {/* Styled View Card Feed */}
                <div className="flashcards-scroll">
                    {isDeleting && <p className="no-cards-notice">Updating deck array items...</p>}
                    {flashcards.length === 0 ? (
                        <p className="no-cards-notice">No flashcards found for this material deck layout.</p>
                    ) : (
                        flashcards.map((f) => (
                            <div key={f.id} className="premium-flashcard-card">
                                {editingId === f.id ? (
                                    <div className="edit-form form-grid">
                                        
                                        {/* Edit Question */}
                                        <div className="form-field-block">
                                            <label>QUESTION:</label>
                                            <textarea
                                                name="question"
                                                disabled={isSaving}
                                                rows={3}
                                                className="dark-textarea"
                                                value={editData.question || ""}
                                                onChange={(e) => handleInputChange(e, setEditData, editData)}
                                            />
                                        </div>

                                        {/* Edit Choices Row Embedded */}
                                        <div className="form-field-block">
                                            <label>CHOICES & CORRECT RESPONSE:</label>
                                            <div className="choices-radio-group">
                                                {[
                                                    { key: "choice_a", letter: "A" },
                                                    { key: "choice_b", letter: "B" },
                                                    { key: "choice_c", letter: "C" },
                                                    { key: "choice_d", letter: "D" }
                                                ].map((choice) => (
                                                    <div key={choice.key} className="embedded-choice-row">
                                                        <label className="radio-label-wrapper">
                                                            <input 
                                                                type="radio" 
                                                                name="edit_correct_choice" 
                                                                value={choice.letter}
                                                                checked={editData.correct_choice?.toUpperCase() === choice.letter}
                                                                disabled={isSaving}
                                                                onChange={(e) => setEditData({ ...editData, correct_choice: e.target.value })}
                                                                className="hidden-radio-input"
                                                            />
                                                            <div className={`radio-custom-bubble ${editData.correct_choice?.toUpperCase() === choice.letter ? "active-bubble-select" : ""}`}>
                                                                {choice.letter}
                                                            </div>
                                                        </label>
                                                        <input
                                                            name={choice.key}
                                                            type="text"
                                                            disabled={isSaving}
                                                            className="dark-input-box choices-inline-input"
                                                            value={editData[choice.key] || ""}
                                                            onChange={(e) => handleInputChange(e, setEditData, editData)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Edit Sub Topic */}
                                        <div className="form-field-block">
                                            <label>SUB TOPIC:</label>
                                            <input
                                                name="sub_topic"
                                                type="text"
                                                disabled={isSaving}
                                                className="dark-input-box"
                                                value={editData.sub_topic || ""}
                                                onChange={(e) => handleInputChange(e, setEditData, editData)}
                                            />
                                        </div>

                                        <div className="flashcard-actions">
                                            <button 
                                                onClick={handleSave} 
                                                disabled={isSaving}
                                                className={`submit-button edit-btn ${isSaving ? "btn-disabled" : ""}`}
                                            >
                                                {isSaving ? "⏳ Saving..." : "💾 Save"}
                                            </button>
                                            <button onClick={() => setEditingId(null)} disabled={isSaving} className="submit-button delete-btn">❌ Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="card-badge-row">
                                            <span className="badge active-badge">Active Flashcard</span>
                                            {f.sub_topic && (
                                                <span className="badge topic-badge">Sub-topic: {f.sub_topic}</span>
                                            )}
                                        </div>

                                        <h3 className="premium-card-question">{f.question}</h3>

                                        <div className="premium-choices-stack">
                                            {[
                                                { letter: "A", text: f.choice_a },
                                                { letter: "B", text: f.choice_b },
                                                { letter: "C", text: f.choice_c },
                                                { letter: "D", text: f.choice_d }
                                            ].map((choice) => {
                                                const isCorrect = f.correct_choice?.toUpperCase() === choice.letter;
                                                return (
                                                    <div 
                                                        key={choice.letter} 
                                                        className={`premium-choice-row ${isCorrect ? 'correct-choice-row' : ''}`}
                                                    >
                                                        <div className={`choice-letter-bubble ${isCorrect ? 'correct-bubble' : ''}`}>
                                                            {choice.letter}
                                                        </div>
                                                        <span className="choice-row-text">{choice.text}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="premium-card-footer">
                                            <div className="flashcard-actions">
                                                <button onClick={() => handleEdit(f)} className="submit-button edit-btn">✏️ Edit </button>
                                                <button onClick={() => triggerDeleteConfirmation(f.id)} className="submit-button delete-btn">🗑️ Delete</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- MODAL 1: CONFIRM DELETION --- */}
            {deleteModal.show && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-card explicit-warning border-red">
                        <div className="modal-icon-warning">⚠️</div>
                        <h3>Confirm Deletion</h3>
                        <p>Are you sure you want to permanently delete this flashcard? This action cannot be undone.</p>
                        <div className="modal-split-actions">
                            <button onClick={confirmDelete} className="submit-button confirm-destructive-btn">Yes, Delete</button>
                            <button onClick={() => setDeleteModal({ show: false, cardId: null })} className="submit-button modal-close-btn gray-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: CENTRAL ALERTS (SUCCESS & ERROR) --- */}
            {alertModal.show && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-card">
                        <div className="modal-icon-status">
                            {alertModal.type === "success" ? "✨" : "⛔"}
                        </div>
                        <h3 className={alertModal.type === "error" ? "text-danger" : ""}>{alertModal.title}</h3>
                        <p>{alertModal.message}</p>
                        <button 
                            onClick={() => setAlertModal({ ...alertModal, show: false })} 
                            className="submit-button modal-close-btn"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherFlashcardsPage;