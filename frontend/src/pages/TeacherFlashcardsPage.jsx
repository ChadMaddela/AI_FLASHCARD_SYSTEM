import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import ClozeText from "../components/ClozeText";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import "../styles/MaterialsPage.css";

const CARD_TYPE_LABELS = {
    MCQ: "Multiple Choice",
    BASIC: "Front / Back",
    CLOZE: "Cloze Deletion",
};

const BLOOM_LEVEL_LABELS = {
    REMEMBERING: "Remembering",
    UNDERSTANDING: "Understanding",
    APPLYING: "Applying",
    ANALYZING: "Analyzing",
    EVALUATING: "Evaluating",
    CREATING: "Creating",
};

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
        card_type: "MCQ",
        question: "",
        choice_a: "",
        choice_b: "",
        choice_c: "",
        choice_d: "",
        correct_choice: "", // Handled cleanly via radio selections now
        answer: "",
        sub_topic: "",
        bloom_level: "",
    });
    const [newFlashcardImage, setNewFlashcardImage] = useState(null);
    const [editImage, setEditImage] = useState(null);
    const [editRemoveImage, setEditRemoveImage] = useState(false);

    const newQuestionRef = useRef(null);
    const editQuestionRef = useRef(null);

    // Inserts "_____" at the current cursor position of a cloze sentence textarea.
    const insertBlankAtCursor = (ref, stateSetter, state) => {
        const textarea = ref.current;
        if (!textarea) return;
        const start = textarea.selectionStart ?? state.question.length;
        const end = textarea.selectionEnd ?? state.question.length;
        const newQuestion = state.question.slice(0, start) + "_____" + state.question.slice(end);
        stateSetter({ ...state, question: newQuestion });
        requestAnimationFrame(() => {
            textarea.focus();
            const cursorPos = start + 5;
            textarea.setSelectionRange(cursorPos, cursorPos);
        });
    };

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

        if (newFlashcard.card_type === "MCQ" && !newFlashcard.correct_choice) {
            setAlertModal({
                show: true,
                type: "error",
                title: "Select Correct Answer",
                message: "Please select which choice (A, B, C, or D) is the correct answer using the radio bubbles."
            });
            return;
        }

        if ((newFlashcard.card_type === "BASIC" || newFlashcard.card_type === "CLOZE") && !newFlashcard.answer.trim()) {
            setAlertModal({
                show: true,
                type: "error",
                title: "Missing Answer",
                message: newFlashcard.card_type === "CLOZE"
                    ? "Please provide the word/phrase that fills in the blank."
                    : "Please provide the back-of-card answer text."
            });
            return;
        }

        setIsCreating(true);
        try {
            const fields = newFlashcard.card_type === "MCQ"
                ? {
                    card_type: "MCQ",
                    question: newFlashcard.question,
                    choice_a: newFlashcard.choice_a,
                    choice_b: newFlashcard.choice_b,
                    choice_c: newFlashcard.choice_c,
                    choice_d: newFlashcard.choice_d,
                    correct_choice: newFlashcard.correct_choice.toUpperCase().trim(),
                    sub_topic: newFlashcard.sub_topic,
                    bloom_level: newFlashcard.bloom_level
                }
                : {
                    card_type: newFlashcard.card_type,
                    question: newFlashcard.question,
                    answer: newFlashcard.answer,
                    sub_topic: newFlashcard.sub_topic,
                    bloom_level: newFlashcard.bloom_level
                };

            const formData = new FormData();
            Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
            if (newFlashcardImage) formData.append("image", newFlashcardImage);

            const res = await api.post(`/materials/${materialId}/flashcards/create/`, formData, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
            });

            setFlashcards([...flashcards, res.data]);
            setNewFlashcard({
                card_type: "MCQ", question: "", choice_a: "", choice_b: "", choice_c: "",
                choice_d: "", correct_choice: "", answer: "", sub_topic: "", bloom_level: "",
            });
            setNewFlashcardImage(null);

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
        setEditImage(null);
        setEditRemoveImage(false);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditImage(null);
        setEditRemoveImage(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const fields = editData.card_type === "MCQ"
                ? {
                    card_type: "MCQ",
                    question: editData.question,
                    choice_a: editData.choice_a,
                    choice_b: editData.choice_b,
                    choice_c: editData.choice_c,
                    choice_d: editData.choice_d,
                    correct_choice: editData.correct_choice,
                    sub_topic: editData.sub_topic,
                    bloom_level: editData.bloom_level,
                }
                : {
                    card_type: editData.card_type,
                    question: editData.question,
                    answer: editData.answer,
                    sub_topic: editData.sub_topic,
                    bloom_level: editData.bloom_level,
                };

            const formData = new FormData();
            Object.entries(fields).forEach(([key, value]) => formData.append(key, value ?? ""));
            if (editImage) {
                formData.append("image", editImage);
            } else if (editRemoveImage) {
                formData.append("remove_image", "true");
            }

            const res = await api.put(`/flashcards/${editingId}/update/`, formData, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
            });

            setFlashcards(flashcards.map((f) => (f.id === editingId ? res.data : f)));
            setEditingId(null);
            setEditImage(null);
            setEditRemoveImage(false);

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

    if (loading) return <LoadingScreen message="Loading flashcards..." />;

    return (
        <div className="flashcards-container">
            <h2>Flashcards for {materialTitle || `Material ${materialId}`}</h2>
            <div className="flashcards-layout">
                
                {/* Create Form Sidebar */}
                <div className="new-flashcard-pane">
                    <h3>Create New Flashcard</h3>
                    <div className="form-grid">

                        {/* 0. Card Type Toggle */}
                        <div className="form-field-block">
                            <label>CARD TYPE:</label>
                            <div className="card-type-toggle">
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    className={`type-toggle-btn ${newFlashcard.card_type === "MCQ" ? "active-toggle" : ""}`}
                                    onClick={() => setNewFlashcard({ ...newFlashcard, card_type: "MCQ" })}
                                >
                                    Multiple Choice
                                </button>
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    className={`type-toggle-btn ${newFlashcard.card_type === "BASIC" ? "active-toggle" : ""}`}
                                    onClick={() => setNewFlashcard({ ...newFlashcard, card_type: "BASIC" })}
                                >
                                    Front / Back
                                </button>
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    className={`type-toggle-btn ${newFlashcard.card_type === "CLOZE" ? "active-toggle" : ""}`}
                                    onClick={() => setNewFlashcard({ ...newFlashcard, card_type: "CLOZE" })}
                                >
                                    Cloze (Fill in the Blank)
                                </button>
                            </div>
                        </div>

                        {/* 1. Question Block */}
                        <div className="form-field-block">
                            <label>
                                {newFlashcard.card_type === "MCQ"
                                    ? "QUESTION:"
                                    : newFlashcard.card_type === "CLOZE"
                                    ? "SENTENCE (USE _____ FOR THE BLANK):"
                                    : "FRONT (QUESTION):"}
                            </label>
                            <textarea
                                ref={newQuestionRef}
                                name="question"
                                disabled={isCreating}
                                rows={3}
                                className="dark-textarea"
                                value={newFlashcard.question}
                                onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                            />
                            {newFlashcard.card_type === "CLOZE" && (
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    className="submit-button insert-blank-btn"
                                    onClick={() => insertBlankAtCursor(newQuestionRef, setNewFlashcard, newFlashcard)}
                                >
                                    ➕ Insert Blank
                                </button>
                            )}
                        </div>

                        {/* 2. Type-specific Block: MCQ choices OR Basic/Cloze answer */}
                        {newFlashcard.card_type === "MCQ" ? (
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
                        ) : (
                            <div className="form-field-block">
                                <label>{newFlashcard.card_type === "CLOZE" ? "ANSWER (THE HIDDEN WORD/PHRASE):" : "ANSWER (BACK OF CARD):"}</label>
                                <textarea
                                    name="answer"
                                    disabled={isCreating}
                                    rows={3}
                                    className="dark-textarea"
                                    value={newFlashcard.answer}
                                    onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                                />
                            </div>
                        )}

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

                        {/* 3b. Bloom's Taxonomy Level (optional, teacher-only) */}
                        <div className="form-field-block">
                            <label>BLOOM'S TAXONOMY LEVEL (OPTIONAL — NOT SHOWN TO STUDENTS):</label>
                            <select
                                name="bloom_level"
                                disabled={isCreating}
                                className="dark-input-box"
                                value={newFlashcard.bloom_level}
                                onChange={(e) => handleInputChange(e, setNewFlashcard, newFlashcard)}
                            >
                                <option value="">Not set</option>
                                {Object.entries(BLOOM_LEVEL_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 4. Image (optional) */}
                        <div className="form-field-block">
                            <label>IMAGE (OPTIONAL):</label>
                            {newFlashcardImage ? (
                                <div className="flashcard-image-preview-wrapper">
                                    <img
                                        src={URL.createObjectURL(newFlashcardImage)}
                                        alt="Selected preview"
                                        className="flashcard-image-preview"
                                    />
                                    <button
                                        type="button"
                                        disabled={isCreating}
                                        className="submit-button delete-btn remove-image-btn"
                                        onClick={() => setNewFlashcardImage(null)}
                                    >
                                        🗑️ Remove Selected Image
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isCreating}
                                    className="dark-input-box"
                                    onChange={(e) => setNewFlashcardImage(e.target.files?.[0] || null)}
                                />
                            )}
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

                                        {/* Edit Card Type Toggle */}
                                        <div className="form-field-block">
                                            <label>CARD TYPE:</label>
                                            <div className="card-type-toggle">
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    className={`type-toggle-btn ${editData.card_type === "MCQ" ? "active-toggle" : ""}`}
                                                    onClick={() => setEditData({ ...editData, card_type: "MCQ" })}
                                                >
                                                    Multiple Choice
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    className={`type-toggle-btn ${editData.card_type === "BASIC" ? "active-toggle" : ""}`}
                                                    onClick={() => setEditData({ ...editData, card_type: "BASIC" })}
                                                >
                                                    Front / Back
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    className={`type-toggle-btn ${editData.card_type === "CLOZE" ? "active-toggle" : ""}`}
                                                    onClick={() => setEditData({ ...editData, card_type: "CLOZE" })}
                                                >
                                                    Cloze (Fill in the Blank)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Edit Question */}
                                        <div className="form-field-block">
                                            <label>
                                                {editData.card_type === "MCQ"
                                                    ? "QUESTION:"
                                                    : editData.card_type === "CLOZE"
                                                    ? "SENTENCE (USE _____ FOR THE BLANK):"
                                                    : "FRONT (QUESTION):"}
                                            </label>
                                            <textarea
                                                ref={editQuestionRef}
                                                name="question"
                                                disabled={isSaving}
                                                rows={3}
                                                className="dark-textarea"
                                                value={editData.question || ""}
                                                onChange={(e) => handleInputChange(e, setEditData, editData)}
                                            />
                                            {editData.card_type === "CLOZE" && (
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    className="submit-button insert-blank-btn"
                                                    onClick={() => insertBlankAtCursor(editQuestionRef, setEditData, editData)}
                                                >
                                                    ➕ Insert Blank
                                                </button>
                                            )}
                                        </div>

                                        {/* Edit Type-specific Block: MCQ choices OR Basic/Cloze answer */}
                                        {editData.card_type === "MCQ" ? (
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
                                        ) : (
                                            <div className="form-field-block">
                                                <label>{editData.card_type === "CLOZE" ? "ANSWER (THE HIDDEN WORD/PHRASE):" : "ANSWER (BACK OF CARD):"}</label>
                                                <textarea
                                                    name="answer"
                                                    disabled={isSaving}
                                                    rows={3}
                                                    className="dark-textarea"
                                                    value={editData.answer || ""}
                                                    onChange={(e) => handleInputChange(e, setEditData, editData)}
                                                />
                                            </div>
                                        )}

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

                                        {/* Edit Bloom's Taxonomy Level */}
                                        <div className="form-field-block">
                                            <label>BLOOM'S TAXONOMY LEVEL (OPTIONAL — NOT SHOWN TO STUDENTS):</label>
                                            <select
                                                name="bloom_level"
                                                disabled={isSaving}
                                                className="dark-input-box"
                                                value={editData.bloom_level || ""}
                                                onChange={(e) => handleInputChange(e, setEditData, editData)}
                                            >
                                                <option value="">Not set</option>
                                                {Object.entries(BLOOM_LEVEL_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Edit Image */}
                                        <div className="form-field-block">
                                            <label>IMAGE (OPTIONAL):</label>
                                            {editImage ? (
                                                <div className="flashcard-image-preview-wrapper">
                                                    <img
                                                        src={URL.createObjectURL(editImage)}
                                                        alt="Selected preview"
                                                        className="flashcard-image-preview"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        className="submit-button delete-btn remove-image-btn"
                                                        onClick={() => setEditImage(null)}
                                                    >
                                                        🗑️ Remove Selected Image
                                                    </button>
                                                </div>
                                            ) : editData.image_url && !editRemoveImage ? (
                                                <div className="flashcard-image-preview-wrapper">
                                                    <img
                                                        src={editData.image_url}
                                                        alt="Current"
                                                        className="flashcard-image-preview"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        className="submit-button delete-btn remove-image-btn"
                                                        onClick={() => setEditRemoveImage(true)}
                                                    >
                                                        🗑️ Remove Image
                                                    </button>
                                                </div>
                                            ) : (
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={isSaving}
                                                    className="dark-input-box"
                                                    onChange={(e) => {
                                                        setEditImage(e.target.files?.[0] || null);
                                                        setEditRemoveImage(false);
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div className="flashcard-actions">
                                            <button 
                                                onClick={handleSave} 
                                                disabled={isSaving}
                                                className={`submit-button edit-btn ${isSaving ? "btn-disabled" : ""}`}
                                            >
                                                {isSaving ? "⏳ Saving..." : "💾 Save"}
                                            </button>
                                            <button onClick={handleCancelEdit} disabled={isSaving} className="submit-button delete-btn">❌ Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="card-badge-row">
                                            <span className="badge active-badge">Active Flashcard</span>
                                            <span className="badge type-badge">
                                                {CARD_TYPE_LABELS[f.card_type] || f.card_type}
                                            </span>
                                            {f.sub_topic && (
                                                <span className="badge topic-badge">Sub-topic: {f.sub_topic}</span>
                                            )}
                                            {f.bloom_level && (
                                                <span className="badge topic-badge">
                                                    Bloom's: {BLOOM_LEVEL_LABELS[f.bloom_level] || f.bloom_level}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="premium-card-question"><ClozeText text={f.question} /></h3>

                                        {f.image_url && (
                                            <img src={f.image_url} alt="" className="flashcard-image-preview premium-card-image" />
                                        )}

                                        {["BASIC", "CLOZE"].includes(f.card_type) ? (
                                            <div className="premium-basic-stack">
                                                <p className="basic-answer-text"><strong>Answer:</strong> {f.answer}</p>
                                            </div>
                                        ) : (
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
                                        )}

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

            <ConfirmModal
                show={deleteModal.show}
                danger
                title="Confirm Deletion"
                message="Are you sure you want to permanently delete this flashcard? This action cannot be undone."
                confirmLabel="Yes, Delete"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ show: false, cardId: null })}
            />
            <AlertModal
                show={alertModal.show}
                type={alertModal.type}
                title={alertModal.title}
                message={alertModal.message}
                onClose={() => setAlertModal({ ...alertModal, show: false })}
            />
        </div>
    );
};

export default TeacherFlashcardsPage;