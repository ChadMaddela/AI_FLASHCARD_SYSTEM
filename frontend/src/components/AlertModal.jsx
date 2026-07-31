import React from "react";
import "../styles/MaterialsPage.css";

/** Reusable success/error dialog, replacing alert(). */
const AlertModal = ({ show, type = "success", title, message, onClose, closeLabel = "Dismiss" }) => {
    if (!show) return null;

    return (
        <div className="custom-modal-overlay">
            <div className="custom-modal-card">
                <div className="modal-icon-status">{type === "success" ? "✨" : "⛔"}</div>
                <h3 className={type === "error" ? "text-danger" : ""}>{title}</h3>
                <p>{message}</p>
                <button onClick={onClose} className="submit-button modal-close-btn">
                    {closeLabel}
                </button>
            </div>
        </div>
    );
};

export default AlertModal;
