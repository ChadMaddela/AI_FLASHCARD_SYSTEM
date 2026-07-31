import React from "react";
import "../styles/MaterialsPage.css";

/** Reusable confirmation dialog, replacing window.confirm(). Set danger for destructive actions. */
const ConfirmModal = ({
    show,
    title = "Confirm",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
    onCancel,
}) => {
    if (!show) return null;

    return (
        <div className="custom-modal-overlay">
            <div className={`custom-modal-card ${danger ? "explicit-warning border-red" : ""}`}>
                {danger && <div className="modal-icon-warning">⚠️</div>}
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-split-actions">
                    <button
                        onClick={onConfirm}
                        className={`submit-button ${danger ? "confirm-destructive-btn" : "create-btn"}`}
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onCancel} className="submit-button modal-close-btn gray-btn">
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
